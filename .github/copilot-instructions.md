# Projet recommandé : FlowOps

Un éditeur visuel de workflows d'API, avec moteur d'exécution, historique et débogage.

Pour ton objectif — maximiser l'intérêt des recruteurs et disposer d'un bon sujet d'entretien — je partirais sur un mini orchestrateur de workflows inspiré des outils d'automatisation, mais volontairement limité à un périmètre maîtrisable en deux à trois semaines.

L'idée est de valoriser ton expérience de React Flow tout en démontrant que tu sais concevoir le reste d'une application : API, base de données, architecture backend, tests et déploiement cloud.

## 1. Le concept produit

FlowOps permet à un développeur de construire un scénario d'intégration en reliant des nœuds visuels, de le sauvegarder, de l'exécuter et d'inspecter son résultat.

Par exemple, un développeur crée ce workflow :

Déclenchement manuel

L'utilisateur lance le scénario

HTTP Request

GET /api/products

Condition

Le code HTTP est-il 200 ?

Oui

Transformer

Extraire les noms des produits

Non

Échec

Afficher le code et l'erreur

Exemple de scénario à construire dans l'application.

Le point différenciant n'est pas le canvas lui-même. C'est le fait que le graphe devienne un véritable programme exécutable, dont on peut suivre chaque étape.

### À qui s'adresse le projet ?

- Aux développeurs qui testent des intégrations entre API.
- Aux équipes qui veulent visualiser un processus technique.
- Aux recruteurs qui souhaitent évaluer ta capacité à aller du frontend jusqu'à la conception et au déploiement.

Je présenterais FlowOps comme un developer tool expérimental, et non comme un concurrent complet de n8n.

## 2. Le périmètre exact du MVP

Le piège serait de passer trois semaines à construire un éditeur visuel, puis de manquer de temps pour le backend et le déploiement. Je fixerais les limites suivantes dès le départ.

A. Éditeur React Flow

Indispensable

- Ajouter, déplacer et supprimer des nœuds.
- Relier les nœuds et valider les connexions.
- Configurer un nœud dans un panneau latéral.
- Sauvegarder et recharger un workflow.

B. Moteur d'exécution backend

Indispensable

Trois types de nœuds au départ :

- `HTTP Request` : appel d'une API.
- `Condition` : comparer une valeur et choisir une branche.
- `Transform` : extraire ou remodeler des données JSON.

Le moteur valide le graphe, exécute les étapes et retourne leurs résultats.

C. Backend et persistance

Indispensable

- API REST avec validation des entrées.
- Authentification utilisateur.
- CRUD des workflows.
- Historique des exécutions et résultats des nœuds.

D. Expérience de débogage

Très valorisant

- Afficher l'état de chaque nœud : en attente, en cours, succès ou échec.
- Voir la durée, le statut HTTP et les sorties.
- Consulter les erreurs et relancer une exécution.

### Ce que je ne développerais pas dans la première version

- Exécution planifiée et déclenchement automatique par webhook.
- Édition collaborative en temps réel.
- Plusieurs utilisateurs par organisation et système complexe de rôles.
- Boucles, exécutions parallèles, retries avancés et compensation distribuée.
- Catalogue d'intégrations tierces.
- Kubernetes ou microservices.

Ce sont des pistes d'évolution, pas des prérequis pour prouver tes compétences.

## 3. Architecture technique

Je recommande un monolithe modulaire : une seule API backend, un seul moteur d'exécution et une base relationnelle. C'est plus facile à livrer et à expliquer qu'une architecture en microservices, tout en permettant de séparer clairement les responsabilités.

Frontend React + TypeScript

React Flow · éditeur · configuration · historique

API Node.js + Express

Authentification · validation · workflows · exécutions

Moteur

Validation du graphe, parcours et exécution des nœuds

Prisma

Accès aux données, migrations et transactions

PostgreSQL

Utilisateurs · workflows · exécutions · résultats

### Stack proposée

| Couche     | Technologie                      | Pourquoi                                        |
| ---------- | -------------------------------- | ----------------------------------------------- |
| Frontend   | React, TypeScript, Vite          | Stack frontend familière et rapide à développer |
| Graphe     | `@xyflow/react`                  | Cœur visuel du produit                          |
| État       | Zustand                          | État local de l'éditeur                         |
| Appels API | TanStack Query                   | Chargement, cache et invalidation               |
| Backend    | Node.js, TypeScript, Express     | API REST et moteur d'exécution                  |
| Validation | Zod                              | Validation des payloads et configurations       |
| ORM        | Prisma                           | Modèles typés et migrations                     |
| Base       | PostgreSQL                       | Relations métier et données JSON                |
| Tests      | Vitest, Supertest                | Tests unitaires et API                          |
| Qualité    | ESLint, Prettier, GitHub Actions | Automatisation de la qualité                    |

Je ne rajouterais pas Redis, une file de messages ou un moteur de jobs externe au départ. Un lancement synchrone avec des limites strictes suffit pour le MVP. Si tu veux ensuite supporter des workflows longs ou beaucoup d'exécutions simultanées, tu pourras introduire une file de jobs.

## 4. Comment concevoir le moteur d'exécution

C'est probablement la partie qui fera le plus la différence en entretien.

Un workflow est un graphe orienté : les nœuds sont les étapes et les arêtes représentent les dépendances. Le moteur ne doit pas simplement parcourir un tableau de nœuds et exécuter chaque entrée dans l'ordre.

Je procéderais ainsi :

### 1

Valider le graphe

Nœuds, types, connexions, références et cycles

### 2

Construire le plan

Ordre topologique des nœuds et dépendances

### 3

Exécuter les étapes

Dispatcher vers le handler HTTP, Condition ou Transform

### 4

Propager les résultats

Sorties des nœuds et sélection des branches

### 5

Persister l'exécution

Statuts, durées, résultats et erreurs

Quelques choix d'architecture intéressants à pouvoir expliquer :

- Séparer le graphe visuel du moteur. Le moteur reçoit un modèle de workflow validé et ne dépend pas de React Flow.
- Définir un contrat commun pour les nœuds. Chaque type possède un schéma de configuration et un handler d'exécution.
- Conserver le contexte d'exécution. Chaque nœud accède aux résultats de ses dépendances sans dépendre de l'état de l'interface.
- Traiter les erreurs explicitement. Un échec HTTP ne doit pas produire un résultat artificiellement réussi ; le moteur doit enregistrer l'erreur et arrêter ou suivre une politique définie.
- Gérer les branches. Une condition sélectionne une sortie, et les nœuds de la branche non retenue ne doivent pas être exécutés.
- Imposer des limites. Timeout des requêtes, taille maximale des réponses, nombre maximal de nœuds et durée maximale d'une exécution.

Un point de sécurité particulièrement intéressant : un utilisateur peut essayer de faire appeler à ton backend des URL internes ou des services cloud sensibles. Le moteur devra bloquer les adresses locales et privées, revalider les redirections et limiter les destinations autorisées. Pour une démonstration publique, ne permets jamais d'envoyer des requêtes arbitraires sans ces protections.

## 5. Modèle de données PostgreSQL

Je partirais sur quatre tables principales et une cinquième seulement si tu souhaites conserver les versions immuables des workflows.

User

Identité

id, email, createdAt

Possède plusieurs workflows et leurs exécutions indirectement.

1 → N

Workflow

Définition

id, userId, name, description, graphJson, updatedAt

`graphJson` contient les nœuds et les connexions sérialisés depuis React Flow.

1 → N

WorkflowRun

Exécution

id, workflowId, status, startedAt, finishedAt, error

Une exécution garde une copie du graphe utilisé, pour pouvoir comprendre le résultat même si le workflow est modifié ensuite.

1 → N

NodeRun

Résultat

id, workflowRunId, nodeId, status, inputJson, outputJson, error, durationMs

Un enregistrement par nœud exécuté, avec son résultat et ses informations de débogage.

### Quelques choix importants

`graphJson` : JSONB ou tables normalisées ?

Pour le graphe lui-même, JSONB est parfaitement adapté : les nœuds et les arêtes constituent un document que l'on sauvegarde et recharge en bloc. En revanche, les utilisateurs, les workflows et les exécutions doivent rester des entités relationnelles.

Pourquoi conserver une copie du graphe dans `WorkflowRun` ?

Imagine que tu modifies une URL après une exécution. Si tu consultes l'ancien historique, tu dois retrouver la configuration qui a réellement été utilisée, et pas la nouvelle.

Faut-il une table `WorkflowVersion` ?

Pas pour le MVP. Tu peux stocker le snapshot du graphe dans chaque exécution. Plus tard, une table de versions immuables permettra de publier, comparer et restaurer des versions de workflow.

### Relations et contraintes à prévoir

- Un utilisateur ne peut consulter ou modifier que ses propres workflows.
- Les identifiants des nœuds doivent être uniques au sein d'un graphe.
- `NodeRun` doit référencer un nœud du snapshot exécuté.
- Les statuts d'exécution doivent être contrôlés : `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, par exemple.
- Les données sensibles, comme les tokens d'API, ne doivent pas être stockées en clair dans le JSON du graphe ni recopiées dans les logs.

## 6. Déploiement Google Cloud

Je choisirais une architecture cloud simple, avec un seul backend conteneurisé.

GitHub

Code, tests et GitHub Actions

Frontend

Firebase Hosting ou Cloud Storage + CDN

API

Cloud Run, image Docker

Cloud SQL — PostgreSQL

Persistance des workflows et de leurs exécutions

Architecture cible, à mettre en place progressivement. Le frontend peut être hébergé séparément du backend.

### Les étapes de déploiement

1. Créer un Dockerfile pour l'API et tester l'image en local.
2. Déployer l'API sur Cloud Run avec des variables de configuration adaptées à l'environnement.
3. Provisionner PostgreSQL sur Cloud SQL, puis exécuter les migrations Prisma.
4. Héberger le frontend sur Firebase Hosting et configurer les appels vers l'API.
5. Configurer GitHub Actions pour lancer les tests, vérifier le typage et construire l'image.
6. Ajouter les secrets et les permissions nécessaires, idéalement avec une identité de service et Workload Identity Federation plutôt qu'une clé Google Cloud statique dans GitHub.

Pour l'authentification, Firebase Authentication peut être intéressant si tu veux rester dans l'écosystème Google. Le backend vérifie alors les tokens Firebase et utilise l'identifiant utilisateur pour isoler les données. Cela évite de développer ton propre système de gestion des mots de passe.

Attention au coût : Cloud Run peut être économique pour une petite démo, mais Cloud SQL constitue un poste de dépense potentiel même lorsque l'application est peu utilisée. Vérifie les tarifs et les conditions des offres au moment de créer les ressources, fixe un budget avec alertes et supprime les ressources inutiles après tes essais si nécessaire.

Documentation officielle : [Cloud Run](https://cloud.google.com/run/docs), [Cloud SQL pour PostgreSQL](https://cloud.google.com/sql/docs/postgres), [Firebase Hosting](https://firebase.google.com/docs/hosting) et [Prisma](https://www.prisma.io/docs).

## 7. Planning de développement sur trois semaines

Je répartirais les efforts de façon à ne jamais finir avec un joli frontend et un backend incomplet.

### &#x20;Semaine 1 — Le produit fonctionne

Socle

Objectif : créer, enregistrer et recharger un workflow.

- Jour 1 : initialisation du monorepo, TypeScript, lint et tests.
- Jour 2 : canvas React Flow, nœuds personnalisés et connexions.
- Jour 3 : panneau de configuration et validation des nœuds.
- Jour 4 : API Express, Prisma et PostgreSQL.
- Jour 5 : sauvegarde, chargement et premiers tests d'intégration.

### Semaine 2 — Le moteur fonctionne

Valeur métier

Objectif : exécuter un scénario de bout en bout.

- Jour 6 : validation du graphe et détection des cycles.
- Jour 7 : moteur d'exécution et nœud HTTP.
- Jour 8 : nœuds Condition et Transform.
- Jour 9 : persistance des exécutions et résultats.
- Jour 10 : états visuels des nœuds, logs et gestion des erreurs.

### Semaine 3 — Le projet est présentable

Portfolio

Objectif : publier une démonstration stable et documentée.

- Jour 11 : authentification et isolation des données.
- Jour 12 : tests du moteur et cas limites.
- Jour 13 : sécurité des appels HTTP et limites d'exécution.
- Jour 14 : déploiement du frontend, de l'API et de la base.
- Jour 15 : README, schéma d'architecture, workflow de démonstration et vidéo courte.

Le planning est ambitieux pour une personne seule. Si tu prends du retard, reporte les fonctions annexes plutôt que les tests, la sécurité et le déploiement.

## 8. Les critères qui feront la différence en entretien

À la fin du projet, tu dois pouvoir montrer une démo et répondre à des questions techniques précises.

| Sujet       | Ce que tu dois pouvoir démontrer                                      |
| ----------- | --------------------------------------------------------------------- |
| React       | Séparation des composants, gestion de l'état du canvas                |
| React Flow  | Nœuds personnalisés, validation des connexions, sérialisation         |
| TypeScript  | Types discriminés par nœud, validation à l'exécution                  |
| Node.js     | API REST, architecture par modules, gestion asynchrone                |
| Algorithmes | Parcours de graphe, ordre topologique, cycles et branches             |
| SQL         | Relations, contraintes, migrations, JSONB                             |
| Tests       | Graphe invalide, API indisponible, branche non sélectionnée           |
| Sécurité    | Isolation des utilisateurs, secrets, prévention des requêtes internes |
| Cloud       | Docker, Cloud Run, base managée, CI/CD et configuration               |

Je préparerais également trois scénarios de démonstration :

1. Le cas nominal : tu construis un workflow, tu l'exécutes et tu visualises ses résultats.
2. Le cas d'erreur : une API renvoie une erreur, tu identifies le nœud responsable et consultes les logs.
3. Le cas de modification : tu changes le workflow, tu relances une exécution et tu montres que l'historique précédent reste cohérent.
