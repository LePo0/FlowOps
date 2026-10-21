# Sessions de démo : scénarios et résultats attendus

_Rédigé avant le développement de l'étape 8 de la [roadmap](../roadmap.md). Chaque scénario devient un test automatisé, puis est revérifié sur l'application lancée en local. Les seuils sont des valeurs de départ, à ajuster après la mise en ligne._

## Pourquoi

FlowOps est d'abord un projet portfolio : un visiteur doit pouvoir le tester **sans créer de compte**, y compris l'enregistrement, l'historique et la relance, qui demandent un workflow enregistré.

Chaque visiteur reçoit donc une **session de démo** : un compte anonyme Firebase (Anonymous Authentication) créé en silence à sa première visite, propre à son navigateur. Il dispose de son propre espace, prérempli de workflows d'exemple, et l'isolation par utilisateur s'applique comme pour un vrai compte. Il peut transformer sa session en vrai compte sans perdre ses workflows.

Options écartées :

- **Compte de démo partagé** (identifiants publics) : chaque visiteur voit et supprime les workflows des autres, et peut changer le mot de passe ou l'email du compte depuis le SDK Firebase. Un compte partagé est de fait anonyme, sans isolation.
- **Mode invité sans compte** (brouillon dans le `localStorage`, `POST /api/run` ouvert) : plus simple, mais l'historique et la relance, au cœur du projet, deviennent impossibles à tester.

Ce que la session de démo change pour la sécurité : n'importe qui peut obtenir un jeton valide, autant de fois qu'il le veut. La politique réseau du nœud HTTP ([`http-node.md`](http-node.md)) protège déjà les cibles internes ; il reste l'**abus de ressources** : relais vers des sites tiers, facture Cloud Run, base qui grossit.

## Menace retenue et principe

Un robot générique (scanner de vulnérabilités, collecteur) passe sur tous les sites publics : il n'obtient rien ici qui ne soit déjà protégé. Une attaque ciblée sur un projet portfolio est peu probable, et aucun petit site ne l'empêche complètement.

Le principe n'est donc pas d'empêcher toute attaque, mais de **borner le pire cas** : quoi qu'il arrive, le coût et le volume de requêtes envoyées depuis FlowOps restent sous des plafonds choisis d'avance, et l'administrateur peut couper les sessions de démo sans redéployer. Un captcha (Cloudflare Turnstile ou Firebase App Check) n'est pas mis en place d'emblée : il reste la réponse prévue si un abus réel est constaté.

## Règles

| Règle                                 | Session de démo                        | Compte vérifié     |
| ------------------------------------- | -------------------------------------- | ------------------ |
| Exécutions par minute, par compte     | 10                                     | 30                 |
| Exécutions par minute, par adresse IP | 20, toutes sessions de démo confondues | —                  |
| Exécutions simultanées, par compte    | 1                                      | 2                  |
| Durée maximale d'une exécution        | 20 s                                   | 60 s               |
| Workflows enregistrés                 | 5                                      | sans limite au MVP |
| Exécutions conservées par workflow    | 10                                     | 50                 |
| Taille d'une réponse HTTP             | 300 Ko                                 | 1 Mo               |
| Résultats conservés par exécution     | 500 Ko, au-delà non conservés          | sans limite        |
| Durée de vie sans activité            | 7 jours, puis suppression              | —                  |

Plafonds globaux, fixés par le déploiement : nombre maximal d'instances Cloud Run, budget avec alertes, et un interrupteur `DEMO_SESSIONS_ENABLED` qui refuse les jetons anonymes (`403`) sans redéploiement de code.

Sans ces limites, une seule session pourrait stocker 50 nœuds × 1 Mo × 50 exécutions, soit 2,5 Go par workflow. Avec elles, une session de démo occupe au plus 5 workflows × 10 exécutions × 500 Ko, soit 25 Mo.

Les valeurs sont dans `apps/api/src/usage/plans.ts`.

## Scénarios

### Identité

| #   | Situation                                                             | Attendu                                                                        |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A1  | Première visite sans session                                          | Session de démo créée sans clic, éditeur affiché avec les workflows d'exemple  |
| A2  | Jeton anonyme valide (`firebase.sign_in_provider` = `anonymous`)      | Accepté sans email ; l'utilisateur est marqué `isAnonymous`                    |
| A3  | Jeton email/mot de passe sans email vérifié                           | `403` `EMAIL_NOT_VERIFIED`, comme aujourd'hui : il n'est pas pris pour anonyme |
| A4  | Jeton anonyme quand `DEMO_SESSIONS_ENABLED=false`                     | `403`, message clair ; les comptes vérifiés ne sont pas touchés                |
| A5  | Session de démo qui tente d'ouvrir le workflow d'un autre utilisateur | `404`, comme pour un vrai compte                                               |
| A6  | Rechargement de la page, ou nouvel onglet du même navigateur          | Même session, mêmes workflows                                                  |
| A7  | Autre navigateur, ou données du site effacées                         | Nouvelle session ; le bandeau prévient que la session est liée au navigateur   |

### Exemples

| #   | Situation                                             | Attendu                                                                     |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| E1  | Premier appel d'une nouvelle session                  | Workflows d'exemple créés une seule fois, même avec des appels simultanés   |
| E2  | Le visiteur supprime ou modifie un exemple            | Il n'est pas recréé                                                         |
| E3  | Une API publique utilisée par un exemple est en panne | Le nœud échoue avec son message habituel : c'est aussi une démo du débogage |

### Quotas

| #   | Situation                                                                      | Attendu                                                                                                                        |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Plus d'exécutions par minute que la limite du compte                           | `429` `RATE_LIMITED`, en-tête `Retry-After` ; aucune URL appelée                                                               |
| Q2  | Plusieurs sessions de démo depuis la même IP, qui dépassent ensemble 20/min    | `429` : créer des sessions ne contourne pas la limite                                                                          |
| Q3  | Deuxième exécution lancée avant la fin de la première (session de démo)        | `429`                                                                                                                          |
| Q4  | Exécution d'une session de démo qui dépasse 20 s, ou réponse de plus de 300 Ko | Arrêt à l'échéance (comme L6 du nœud HTTP), ou nœud en échec « Réponse trop volumineuse »                                      |
| Q5  | Sixième workflow enregistré par une session de démo                            | `403` `QUOTA_EXCEEDED`, message qui invite à créer un compte                                                                   |
| Q6  | Onzième exécution d'un workflow de démo                                        | Enregistrée ; la plus ancienne est supprimée                                                                                   |
| Q7  | Exécution d'une session de démo dont les résultats dépassent 500 Ko            | Réponse complète ; dans l'historique, entrée et sortie des nœuds au-delà remplacées par un message, statut et erreur conservés |
| Q8  | Adresse IP du visiteur derrière Cloud Run                                      | Lue dans `X-Forwarded-For` posé par Google, pas dans un en-tête fourni par le client                                           |
| Q9  | Compteur après un redémarrage, ou avec plusieurs instances                     | Accepté : compteur en mémoire, Cloud Run limité à peu d'instances (limite approximative)                                       |

### Nettoyage

| #   | Situation                                                               | Attendu                                                                                                 |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| N1  | Session de démo inactive depuis plus de 7 jours                         | Supprimée de la base (workflows et exécutions en cascade), au démarrage de l'API puis toutes les heures |
| N2  | Vrai compte, ou session active il y a moins de 7 jours                  | Conservé                                                                                                |
| N3  | Le visiteur revient après la suppression (même compte anonyme Firebase) | Nouvelle session avec les exemples, comme une première visite                                           |
| N4  | Activité d'une session                                                  | `lastSeenAt` mis à jour au plus une fois par heure : pas d'écriture à chaque requête                    |

### Passage à un vrai compte

| #   | Situation                                                | Attendu                                                                                                    |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| U1  | Création d'un compte (Google ou email) depuis le bandeau | Même uid Firebase (`linkWithCredential`) : workflows et historique conservés, quotas du compte vérifié     |
| U2  | Email/mot de passe non encore vérifié après le passage   | `403` `EMAIL_NOT_VERIFIED` jusqu'à la vérification, comme une inscription ordinaire                        |
| U3  | Identifiants déjà liés à un compte existant              | Connexion à ce compte ; l'éditeur prévient avant que les workflows de la session de démo soient abandonnés |
| U4  | Déconnexion d'un vrai compte                             | Nouvelle session de démo vierge : rien du compte précédent ne reste à l'écran                              |

### Contenu et configuration

| #   | Situation                                                | Attendu                                                                                               |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| X1  | Nom de workflow ou valeur contenant du HTML ou un script | Affiché comme du texte (React échappe, aucun `dangerouslySetInnerHTML`)                               |
| X2  | Contenu choquant enregistré par un visiteur              | Visible par lui seul : aucun partage public. Un partage futur demandera de revoir ce point            |
| X3  | Projet Firebase utilisé depuis un autre site             | Refusé : domaines autorisés limités à celui de l'éditeur, clé d'API restreinte par référent           |
| X4  | Clé d'API saisie dans un nœud par un visiteur            | Stockée dans son graphe, masquée dans l'historique si l'en-tête porte un nom sensible (limite connue) |

## Vérification

1. **Avant le développement** : les scénarios sont traduits en tests automatisés (middleware, quotas, nettoyage, routes). Ceux qui portent sur une protection absente échouent sur le code actuel.
2. **Pendant** : développement jusqu'à ce que tous les tests passent, puis en CI à chaque pull request.
3. **À la fin** : vérification sur l'application lancée en local avec l'émulateur Firebase Auth (session de démo, passage à un vrai compte, quotas atteints, nettoyage). Les résultats sont consignés ci-dessous.

## Résultats de la vérification finale

_À venir._

## Risques acceptés

- **Comptes anonymes Firebase conservés** : le nettoyage ne supprime que les données de FlowOps. Un compte anonyme Firebase ne contient rien, et le supprimer demanderait des identifiants d'administration Firebase sur l'API. Si leur nombre devient gênant, Identity Platform sait supprimer automatiquement les comptes anonymes anciens.
- **Place libérée par un client qui abandonne** : la limite d'exécutions simultanées se libère quand la connexion se ferme, même si l'exécution continue jusqu'à son échéance. La limite par minute borne ce cas.

- **Limite par IP contournable** par un attaquant qui dispose de nombreuses adresses : le plafond global et le budget bornent alors le coût.
- **Firebase** : la création de comptes anonymes est limitée par Firebase lui-même, selon des quotas qui ne dépendent pas de FlowOps. Le plan de facturation (Identity Platform ou non) est à vérifier avant la mise en ligne.
- **API publiques des exemples** : beaucoup de visiteurs à la fois partagent les mêmes adresses Cloud Run, et un service tiers peut limiter ces adresses. L'exemple échoue alors proprement (E3).
