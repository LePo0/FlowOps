# Sécurité du nœud HTTP : scénarios et résultats attendus

_Rédigé avant le développement de l'étape 5 de la [roadmap](../roadmap.md). Chaque scénario devient un test automatisé, puis est revérifié sur l'application lancée en local._

## Pourquoi

Le nœud HTTP fait appeler par le **serveur** une URL choisie par l'utilisateur. Le serveur voit des adresses qu'un internaute ne voit pas : lui-même, le réseau privé de son hébergeur, le serveur de métadonnées du cloud (qui distribue les identifiants du compte de service), et, dans une entreprise, tout le réseau interne. Sans contrôle, le nœud HTTP devient un relais vers ces adresses : c'est une **SSRF** (_Server-Side Request Forgery_).

Le même nœud peut aussi épuiser le serveur : réponse énorme, réponse qui grossit à la décompression, serveur qui répond au compte-gouttes, workflow interminable.

## Modes de déploiement et politique réseau

FlowOps doit fonctionner dans deux contextes, avec le même code :

| Mode                       | Configuration                                     | Cibles autorisées                                                     |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| SaaS public (défaut)       | aucune                                            | Adresses publiques uniquement                                         |
| Installation en entreprise | `HTTP_ALLOWED_TARGETS` (et `HTTP_DENIED_TARGETS`) | Adresses publiques + réseaux et domaines listés, moins les exclusions |

Règles, dans l'ordre :

1. **Toujours interdit**, même si une liste l'autorise : boucle locale (`127.0.0.0/8`, `::1`), lien local (`169.254.0.0/16`, `fe80::/10`, dont le serveur de métadonnées), adresse non spécifiée (`0.0.0.0`, `::`). Aucun usage légitime ne le justifie.
2. **Exclusions** (`HTTP_DENIED_TARGETS`) : réseaux que l'administrateur protège explicitement, par exemple celui de la base de FlowOps.
3. **Autorisations** (`HTTP_ALLOWED_TARGETS`) : réseaux (notation CIDR) et domaines internes ouverts.
4. **Adresses publiques** : autorisées.
5. **Tout le reste** (réseaux privés, partagés, réservés, multicast) : refusé.

La politique est **globale au déploiement** : elle s'applique à tous les utilisateurs. Elle est fixée par l'administrateur en variables d'environnement, jamais par un utilisateur ou dans un workflow. Une configuration invalide empêche le serveur de démarrer : une erreur de saisie ne doit pas ouvrir le réseau en silence.

La décision porte sur l'**adresse IP effectivement contactée** : le nom de domaine est résolu, chaque adresse obtenue est vérifiée, et la connexion se fait vers une adresse vérifiée, sans seconde résolution.

## Scénarios

Légende des modes : **D** = défaut (SaaS), **E** = entreprise, avec `HTTP_ALLOWED_TARGETS=10.20.0.0/16,*.interne.test` et `HTTP_DENIED_TARGETS=10.20.99.0/24` pour les exemples.

### Cibles

| #   | Situation                                                                                    | Attendu                                                              |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| C1  | URL publique ordinaire                                                                       | Appel effectué (D, E) : non-régression                               |
| C2  | Boucle locale : `localhost`, `127.0.0.1`, `[::1]`, l'API FlowOps elle-même                   | Refus (D, E), y compris si la liste d'autorisation la contient       |
| C3  | Serveur de métadonnées du cloud, par adresse ou par nom                                      | Refus (D, E), y compris si la liste d'autorisation le contient       |
| C4  | Adresse privée (`10.x`, `172.16–31.x`, `192.168.x`, `fc00::/7`, `100.64.0.0/10`)             | Refus (D) ; autorisée en E seulement si elle est dans la liste       |
| C5  | Adresse privée dans la liste mais aussi dans les exclusions (`10.20.99.5`)                   | Refus (E)                                                            |
| C6  | Domaine interne listé (`api.interne.test`) qui résout vers une adresse autorisée             | Appel effectué (E) ; refus (D)                                       |
| C7  | Adresse interdite écrite autrement (entier, hexadécimal, forme abrégée, IPv6 mappée en IPv4) | Refus : la décision porte sur l'adresse normalisée, pas sur le texte |
| C8  | Nom de domaine public qui résout vers une adresse interdite                                  | Refus                                                                |
| C9  | Nom qui résout vers plusieurs adresses dont une interdite                                    | Refus                                                                |
| C10 | Résolution qui change entre la vérification et la connexion                                  | La connexion utilise l'adresse vérifiée : pas de seconde résolution  |
| C11 | Schéma autre que `http:` / `https:` (`file:`, `ftp:`, `data:`…)                              | Refus                                                                |
| C12 | URL interdite obtenue via une `{{référence}}` (champ d'une réponse précédente)               | Refus au moment de l'appel, comme une URL saisie                     |

### Redirections

| #   | Situation                                                                             | Attendu                                                             |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| R1  | Redirection d'une URL autorisée vers une autre URL autorisée                          | Suivie ; le détail d'exécution indique l'URL finale                 |
| R2  | Redirection d'une URL autorisée vers une cible interdite (C2 à C5)                    | Refus à l'étape concernée, aucune connexion vers la cible interdite |
| R3  | Plus de 5 redirections successives                                                    | Échec du nœud                                                       |
| R4  | Redirection vers un autre domaine avec un en-tête `Authorization`, `Cookie` ou de clé | En-têtes sensibles retirés avant de suivre                          |
| R5  | Réponse `303` à un `POST`                                                             | Suivie en `GET`, sans corps                                         |

### Ressources

| #   | Situation                                                                | Attendu                                                                    |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| L1  | Réponse de plus de 1 Mo                                                  | Lecture interrompue dès 1 Mo, connexion fermée, nœud en échec              |
| L2  | Même cas avec un `Content-Length` absent ou inférieur à la taille réelle | Même résultat : la limite porte sur les octets reçus, pas sur l'en-tête    |
| L3  | `Content-Length` supérieur à 1 Mo                                        | Refus sans lire le corps                                                   |
| L4  | Réponse compressée qui dépasse 1 Mo une fois décompressée                | Coupure sur la taille décompressée                                         |
| L5  | Serveur qui envoie le corps très lentement                               | Délai du nœud appliqué à toute la lecture, pas seulement à la connexion    |
| L6  | Workflow dont la somme des délais dépasse l'échéance globale             | Exécution arrêtée à l'échéance, nœuds restants non exécutés, message clair |

### Informations divulguées

| #   | Situation                                     | Attendu                                                                                 |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| I1  | Cible refusée par la politique                | Un seul message, « Adresse non autorisée », qu'elle existe ou non, port ouvert ou fermé |
| I2  | Détail d'exécution d'une cible refusée        | Ni adresse IP résolue, ni cause réseau                                                  |
| I3  | En-têtes sensibles dans le détail d'exécution | Masqués (`***`), comme aujourd'hui                                                      |

### Configuration

| #   | Situation                                                 | Attendu                                                            |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| K1  | `HTTP_ALLOWED_TARGETS` ou `HTTP_DENIED_TARGETS` mal formé | Le serveur refuse de démarrer, message précis                      |
| K2  | Liste d'autorisation trop large (`0.0.0.0/0`)             | Acceptée, mais les cibles « toujours interdites » restent refusées |

## Vérification

1. **Avant le développement** : les scénarios sont traduits en tests automatisés (moteur et API). Ceux qui portent sur une protection absente échouent sur le code actuel, ce qui prouve qu'ils détectent le problème.
2. **Pendant** : la politique réseau, la lecture bornée et l'échéance sont écrites jusqu'à ce que tous les tests passent. Ces tests tournent ensuite en CI à chaque pull request.
3. **À la fin** : vérification sur l'application lancée en local, avec un compte de test et des services factices démarrés sur le poste (cibles internes simulées, serveur qui redirige, réponse volumineuse, réponse lente), dans les deux modes. Les résultats sont consignés ci-dessous.

## Résultats de la vérification finale

_À compléter à la fin de l'étape 5._
