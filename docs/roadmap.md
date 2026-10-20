# Roadmap FlowOps

_Dernière mise à jour : 19 octobre 2026._

## Fait

- [x] Monorepo npm workspaces (`apps/web`, `apps/api`, `packages/shared`)
- [x] ESLint, Prettier, validation des variables d'environnement
- [x] CI GitHub Actions (lint, typecheck, tests, format), `main` protégé
- [x] Schémas Zod du workflow, workflow de démonstration (`packages/shared`)
- [x] `validateGraph` et tri topologique
- [x] Exécution des nœuds (trigger, HTTP, condition, transform), branches, politique d'échec
- [x] Nœud HTTP : `{{références}}` dans l'URL, les en-têtes et le corps ; détail de chaque exécution
- [x] Transformation : filtre, champ à extraire, chemins imbriqués

## À faire, dans l'ordre

### 1. Route `POST /api/run`

- [x] Validation de l'entrée avec Zod
- [x] 400 pour un graphe invalide, 200 avec les résultats par nœud
- [x] Tests Supertest
- Montée dans tous les environnements depuis l'étape 5 (sécurité du nœud HTTP)

### 2. Canvas React Flow

- [x] Nœuds personnalisés (un par type)
- [x] Validation des connexions
- [x] Panneau de configuration d'un nœud
- [x] Store Zustand, `toGraph()` / `fromGraph()`
- [x] Bouton « Exécuter » et statuts par nœud
- **Jalon : parcours créer → exécuter → voir le résultat, sans base de données** (atteint)

### 3. Persistance

- [x] Choix de la base : PostgreSQL 18 en local (instance utilisateur sur le port 5433), service `postgres:18` jetable en CI pour les tests d'intégration
- [x] Prisma : `User`, `Workflow`, `WorkflowRun`, `NodeRun`, migrations
- [x] CRUD des workflows (API et éditeur : enregistrer, ouvrir, supprimer)
- [x] Historique des exécutions : enregistrement de chaque exécution d'un workflow enregistré (50 dernières), consultation par l'API ; affichage dans l'éditeur à l'étape 6

### 4. Authentification

- [x] Choix : Firebase Auth (Google et email/mot de passe), projets `-dev` et `-prod` séparés
- [x] API : jeton Firebase vérifié avec `jose` (signature, projet, émetteur, dates), 401 sans jeton valide, 403 si l'email n'est pas vérifié, `User.authUid`, utilisateur de démonstration supprimé, CORS limité à l'éditeur
- [x] Isolation des données par utilisateur : toutes les routes `/api` derrière l'authentification, 404 sur les ressources d'autrui
- [x] Tests d'isolation et du vérificateur (jetons signés par une clé de test, sans réseau)
- [x] Éditeur : écran de connexion (Google, email/mot de passe, inscription, mot de passe oublié), jeton sur chaque appel, déconnexion qui vide l'état local
- [x] Documentation : configuration Firebase et variables d'environnement

### 5. Sécurité du nœud HTTP

FlowOps doit pouvoir être proposé en SaaS public **et** installé dans une entreprise pour appeler ses API internes. La protection repose donc sur une politique réseau fixée par l'administrateur du déploiement, pas sur un blocage figé. Scénarios et résultats attendus : [`docs/security/http-node.md`](security/http-node.md).

- [x] Scénarios de sécurité rédigés avant le développement
- [x] Politique réseau des cibles (SSRF), vérifiée sur l'adresse IP résolue et appliquée à la connexion, y compris pour les URL construites avec des `{{références}}` :
  - par défaut, adresses publiques uniquement ;
  - `HTTP_ALLOWED_TARGETS` : réseaux et domaines internes ouverts par l'administrateur ;
  - `HTTP_DENIED_TARGETS` : exclusions qui l'emportent sur la liste précédente (ex. le réseau de la base de FlowOps) ;
  - toujours interdits, quelle que soit la configuration : boucle locale, adresses de lien local (dont le serveur de métadonnées du cloud), adresse non spécifiée
- [x] Redirections suivies par FlowOps : 5 au maximum, chacune revalidée, en-têtes sensibles retirés quand le domaine change
- [x] Lecture de la réponse en flux, coupée au-delà de 1 Mo décompressé
- [x] Durée maximale d'une exécution (échéance globale), 60 s par défaut
- [x] Message unique pour une cible refusée : pas d'indice sur l'existence d'une machine ou d'un port
- [x] Scénarios traduits en tests automatisés, puis vérification finale sur l'application lancée en local
- [x] Exécution montée en production une fois les points précédents faits
- **Prérequis avant toute mise en ligne**

### 6. Débogage dans l'interface

- [x] Historique des exécutions : fenêtre « Historique » d'un workflow enregistré (50 dernières exécutions)
- [x] Détail par nœud (entrée, sortie, durée, erreur), noms tirés de la copie du graphe exécuté
- [x] Relance d'une exécution : rejoue la copie du graphe stockée, telle qu'elle a tourné, et l'ajoute à l'historique

### 7. Tests complémentaires

- [x] Cas limites du moteur : opérateurs de comparaison, fusion de branches, référence vers un nœud ignoré ou inexistant, réponse JSON mal formée, échéance atteinte entre deux nœuds, échecs DNS et de connexion
- [x] Tests d'API : exécution en échec enregistrée, corps invalides, workflow supprimé pendant l'exécution, réponse déjà commencée ; configuration de démarrage (`config/server-config.ts`) testée : variables obligatoires, listes réseau invalides, message d'une base injoignable
- [ ] Scénarios de bout en bout (nominal, erreur, modification) : Playwright et émulateur Firebase Auth. Les jetons de l'émulateur ne sont pas signés : l'API ne les accepte que si `FIREBASE_AUTH_EMULATOR_HOST` est défini, et refuse de démarrer avec cette variable en production

### 8. Déploiement

- [ ] **Limite d'exécutions par utilisateur, prérequis avant la mise en ligne** : avec l'inscription ouverte, rien n'empêche aujourd'hui un compte de lancer des exécutions en boucle (relais pour inonder un site tiers depuis nos adresses, facture Cloud Run). Par exemple 30 exécutions par minute et par compte, `429` au-delà ; à cadrer : seuils, compteur partagé entre plusieurs instances
- [ ] Dockerfile de l'API
- [ ] Cloud Run et base managée
- [ ] Frontend sur Firebase Hosting
- [ ] Déploiement via GitHub Actions (Workload Identity Federation, pas de clé statique)
- [ ] Budget et alertes de coût
- [ ] Installation en entreprise : image Docker de l'API et de l'éditeur configurable par variables d'environnement (politique réseau, projet Firebase, base), documentée

### 9. Finitions portfolio

- [ ] README
- [ ] `docs/architecture.md` à jour avec un schéma final
- [ ] `docs/decisions.md`
- [ ] Trois scénarios de démonstration
- [ ] Vidéo courte

## Hors périmètre (pistes d'évolution)

Exécution planifiée, webhooks, édition collaborative, organisations et rôles, boucles et exécutions parallèles, retries avancés, catalogue d'intégrations, file de jobs.

- **Coffre de secrets** : `{{secrets.NOM}}` dans les nœuds, valeurs chiffrées en base, jamais renvoyées par l'API, masquées dans l'historique. En attendant, une clé saisie dans un nœud est stockée dans le graphe ; seuls les en-têtes au nom sensible sont masqués dans le détail d'exécution.
- **SSO d'entreprise** (Microsoft Entra ID, Okta… via OIDC ou SAML) : possible avec Firebase / Identity Platform sans changer l'API.
- **Politique réseau par utilisateur ou par rôle** : demande les rôles ; la politique reste globale au déploiement.
- **Versions d'un workflow** : enregistrer une version, ou en créer une autre sans dupliquer le workflow. Depuis l'historique : aperçu du graphe exécuté en lecture seule (statut de chaque nœud, branche prise), puis ouverture de cette version dans l'éditeur pour la corriger et la rejouer, sans perdre la version en cours.

## Règle de priorité

Si le temps manque, reporter les finitions de l'interface plutôt que les tests, la sécurité et le déploiement.
