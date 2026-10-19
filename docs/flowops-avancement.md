# FlowOps — Avancement détaillé

_État au 15 octobre 2026. Le setup, les schémas du workflow, la validation du graphe et le moteur d'exécution sont mergés dans `main`._

## 1. Le projet

FlowOps est un éditeur visuel de workflows d'API avec moteur d'exécution, historique et débogage. Le graphe construit dans l'interface devient un programme exécutable dont on suit chaque étape. Objectif : un projet portfolio qui couvre le frontend, l'API, la base de données, les tests, la CI et le déploiement cloud.

Périmètre du MVP : quatre types de nœuds (déclencheur, requête HTTP, condition, transformation), exécution synchrone, historique des exécutions, authentification et déploiement sur Google Cloud. Hors périmètre : planification, webhooks, collaboration temps réel, boucles et parallélisme, catalogue d'intégrations.

## 2. Décisions techniques

| Sujet                   | Choix                                              | Raison                                                                                                |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gestionnaire de paquets | npm workspaces                                     | Déjà fourni avec Node, aucun outil supplémentaire                                                     |
| Hébergement et CI       | GitHub, GitHub Actions                             | Choix du projet (migré depuis GitLab en octobre 2026)                                                 |
| Frontend                | Vite + React + TypeScript + React Compiler         | Stack maîtrisée                                                                                       |
| Backend                 | Node.js + Express + TypeScript, exécuté avec `tsx` | API REST simple                                                                                       |
| Validation              | Zod, partagé entre front et back                   | Une seule source de vérité                                                                            |
| Tests                   | Vitest, Supertest                                  | Même écosystème que Vite                                                                              |
| Qualité                 | ESLint + Prettier                                  | Config racine pour `api` et `shared`, config du template Vite pour `web`                              |
| Architecture            | Monolithe modulaire                                | Plus simple à livrer et à expliquer                                                                   |
| Base de données         | Reportée à l'arrivée de Prisma                     | WSL et conteneurs bloqués sur le poste : base hébergée, Postgres portable ou service temporaire en CI |

## 3. Structure actuelle du dépôt

```
flowops/
├─ apps/
│  ├─ web/                          Vite + React + TS (React Flow à venir)
│  └─ api/
│     └─ src/
│        ├─ app.ts                  App Express, GET /health
│        ├─ app.test.ts
│        ├─ index.ts                Démarrage du serveur
│        ├─ config/env.ts           Variables d'environnement validées par Zod
│        └─ engine/
│           ├─ types.ts
│           ├─ topological-sort.ts  (+ .test.ts)
│           ├─ validate-graph.ts    (+ .test.ts)
│           ├─ resolve-reference.ts (+ .test.ts)
│           ├─ handlers.ts
│           ├─ execute-workflow.ts  (+ .test.ts)
│           └─ index.ts
├─ packages/shared/                 @flowops/shared
│  └─ src/
│     ├─ workflow.ts
│     ├─ workflow.test.ts
│     ├─ fixtures/demo-workflow.ts
│     └─ index.ts
├─ .github/workflows/ci.yml
├─ eslint.config.mjs
├─ tsconfig.base.json
├─ .prettierrc / .prettierignore
└─ package.json                     Workspaces et scripts globaux
```

## 4. Fichiers de configuration à la racine

- **`package.json`** : déclare les workspaces `apps/*` et `packages/*` et les scripts globaux (`dev:web`, `dev:api`, `test`, `lint`, `typecheck`, `format`, `format:check`).
- **`tsconfig.base.json`** : options TypeScript communes (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: Bundler`), étendues par `api` et `shared`.
- **`eslint.config.mjs`** : config ESLint (typescript-eslint, `eslint-config-prettier`) pour `api` et `shared`. `apps/web` est ignoré car il garde la config de son template.
- **`.prettierrc` et `.prettierignore`** : formatage commun à tout le dépôt.
- **`.github/workflows/ci.yml`** : quatre jobs GitHub Actions en parallèle (`lint`, `typecheck`, `test` avec un service PostgreSQL, `format`), cache npm indexé sur `package-lock.json`, pipelines limités aux pull requests et à la branche principale.

## 4 bis. `apps/api` : le squelette

- **`src/app.ts`** : crée l'app Express (`helmet`, `cors` limité à `CORS_ORIGIN`, `express.json`) et expose `GET /health`. Il n'appelle pas `listen`.
- **`src/index.ts`** : importe l'app et démarre le serveur sur `env.PORT`.
- **`src/app.test.ts`** : test Supertest sur `/health`. La séparation `app.ts` / `index.ts` permet de tester sans ouvrir de port.
- **`src/config/env.ts`** : schéma Zod des variables (`NODE_ENV`, `PORT`, `CORS_ORIGIN`, `DATABASE_URL` optionnel pour l'instant). L'API refuse de démarrer si une variable est invalide. Le fichier `.env` est ignoré par Git, `.env.example` est versionné.

## 5. `packages/shared` : le contrat du workflow

### `src/workflow.ts`

- Constantes de limites : `MAX_NODES = 50`, `MAX_EDGES = 100`.
- `NodeTypeSchema` : `trigger`, `http`, `condition`, `transform`.
- Champs communs de chaque nœud (`id`, `name`, `position`). L'`id` suit une regex (lettres, chiffres, `_`, `-`, 64 caractères maximum), donc **sans point** : les références entre nœuds se découpent sur le point.
- Un schéma par type de nœud, avec sa `config` :
  - `TriggerNodeSchema` : config vide.
  - `HttpNodeSchema` : `method` (GET, POST, PUT, PATCH, DELETE), `url`, `headers`, `body`, `timeoutMs` (tous optionnels sauf méthode et URL).
  - `ConditionNodeSchema` : `left` (référence), `operator` (`eq`, `neq`, `gt`, `lt`, `contains`, `exists`), `right`.
  - `TransformNodeSchema` : `source` (référence) et `pick` (champs à conserver).
- `WorkflowNodeSchema` : **union discriminée sur `type`**, ce qui permet à TypeScript de déduire la bonne `config` après un test sur `node.type`.
- `EdgeSchema` : `id`, `source`, `target` et `branch` (`"true"` ou `"false"`) pour les sorties d'une condition.
- `WorkflowGraphSchema` : `nodes` (1 à 50) et `edges` (jusqu'à 100), plus les types inférés (`WorkflowNode`, `HttpNode`, `ConditionNode`, `TransformNode`, `WorkflowEdge`, `WorkflowGraph`).

Le schéma ne vérifie que **la forme**. Les règles de structure sont dans `validateGraph`.

### `src/fixtures/demo-workflow.ts`

Le workflow de démonstration : `trigger` → `http1` (GET sur une API publique de test) → `check` (condition : `http1.status` égal à 200) → `names` (transform : extrait `title` de `http1.body.products`, uniquement sur la branche `true`).

### `src/workflow.test.ts` et `src/index.ts`

Les tests vérifient : acceptation du workflow de démo, rejet d'un type de nœud inconnu, d'une méthode HTTP invalide, d'un dépassement de `MAX_NODES` et d'un id contenant un point. `index.ts` réexporte `workflow.ts` et `demoWorkflow`.

## 6. `apps/api/src/engine` : le moteur

Le moteur est du **TypeScript pur** : il ne dépend ni d'Express, ni de Prisma, ni de React Flow.

### `types.ts`

Types partagés du moteur : `ValidationError` (avec des codes stables : `INVALID_SHAPE`, `DUPLICATE_NODE_ID`, `UNKNOWN_NODE`, `TRIGGER_COUNT`, `TRIGGER_HAS_INCOMING_EDGE`, `INVALID_BRANCH`, `CYCLE`), `ValidationResult`, `NodeResult` (statut `SUCCESS`, `FAILED` ou `SKIPPED`, sortie, erreur, durée), `ExecutionResult` (`INVALID`, `SUCCESS` ou `FAILED`), `ExecutionDeps`, `HandlerContext` et `HandlerResult`.

### `topological-sort.ts`

Algorithme de Kahn : retourne les identifiants dans un ordre où chaque nœud passe après ses dépendances, ou `null` en cas de cycle. Complexité `O(nœuds + arêtes)`. Il sert à la fois à ordonner l'exécution et à détecter les cycles.

### `validate-graph.ts`

Validation en deux niveaux :

1. la **forme**, via `WorkflowGraphSchema` ;
2. la **structure** : ids uniques, un seul déclencheur, arêtes vers des nœuds existants, aucun arc entrant sur le déclencheur, `branch` obligatoire sur les sorties d'une condition et interdite ailleurs, absence de cycle.

La fonction **retourne** un résultat `ok / errors` au lieu de lancer une exception, et le test de cycle n'est fait que si le reste est cohérent.

### `resolve-reference.ts`

Résout les références de la forme `idDuNoeud.chemin.vers.valeur` (par exemple `http1.status`, `http1.body.products.0.title`) dans les sorties déjà produites. Il lance une erreur si le nœud est inconnu ou non exécuté, retourne `undefined` si le chemin n'existe pas, et ne lit que les **propriétés propres** des objets, jamais `__proto__` ni `constructor`.

### `handlers.ts`

Un handler par type de nœud, avec un contrat commun : il reçoit le nœud et un contexte, retourne `{ output, branch? }` et lance une exception en cas d'échec.

- **trigger** : sortie vide.
- **http** : appelle le `fetch` **injecté** avec timeout (10 s par défaut) ; refuse une réponse de plus d'un million de caractères ; parse le JSON si le `content-type` l'indique. Un statut 4xx ou 5xx n'est **pas** une erreur du moteur : la sortie contient `status`, `ok` et `body`, et c'est la condition qui décide.
- **condition** : évalue `eq`, `neq`, `gt`, `lt`, `contains` ou `exists` et retourne la branche `true` ou `false`.
- **transform** : extrait une valeur par référence et, si `pick` est défini, conserve certains champs sur un objet ou sur chaque élément d'un tableau.
- **`runHandler`** : dispatch par `switch` sur `node.type`, vérifié par TypeScript.

### `execute-workflow.ts`

`executeWorkflow(input, { fetch })` :

1. valide le graphe et retourne `INVALID` avec les erreurs si besoin ;
2. calcule l'ordre topologique ;
3. exécute les nœuds un par un avec un contexte qui accumule les sorties ;
4. applique la **règle des branches** : un nœud s'exécute s'il est le déclencheur, ou si au moins une arête entrante est active (sa source a réussi et, si l'arête a une `branch`, c'est celle choisie par la condition) ; sinon il est `SKIPPED` ;
5. applique la **politique d'échec** : au premier nœud en échec, les suivants sont `SKIPPED` ;
6. retourne le statut global, le résultat de chaque nœud et la durée.

### `index.ts`

Expose `validateGraph`, `topologicalSort`, `executeWorkflow`, `resolveReference` et les types.

## 7. Tests

| Fichier                     | Ce qui est vérifié                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow.test.ts` (shared) | Forme du graphe, limites, type inconnu, méthode invalide, id avec point                                                                                                         |
| `topological-sort.test.ts`  | Ordre sur un losange, cycle, nœuds sans arête                                                                                                                                   |
| `validate-graph.test.ts`    | 10 cas : graphe valide, forme invalide, doublon d'id, arête inconnue, déclencheur absent ou en double, arête entrante sur le déclencheur, branche manquante ou superflue, cycle |
| `resolve-reference.test.ts` | Valeur imbriquée, chemin absent, propriétés héritées ignorées, nœud non exécuté                                                                                                 |
| `execute-workflow.test.ts`  | Scénario nominal, réponse 404 (branche non sélectionnée ignorée), erreur réseau (échec puis nœuds ignorés), graphe invalide                                                     |
| `app.test.ts` (api)         | `GET /health`                                                                                                                                                                   |

Les tests du moteur n'appellent jamais le réseau : le `fetch` est simulé.

## 8. Workflow Git et livraisons

- Setup fait sur `main`, puis `main` protégé : les changements passent par des pull requests avec pipeline vert, squash et suppression de la branche source.
- Branches courtes par fonctionnalité (`feat/…`, `fix/…`, `chore/…`, `docs/…`), messages au format Conventional Commits.

Merge requests réalisées (sur GitLab, avant la migration vers GitHub) :

1. **`feat/workflow-schemas`** : `workflow.ts`, `demo-workflow.ts`, `workflow.test.ts`, `index.ts` dans `packages/shared`.
2. **`feat/execution-engine`** : `types.ts`, `topological-sort.ts`, `validate-graph.ts`, `index.ts` et leurs tests dans `apps/api/src/engine`.
3. **`feat/node-execution`** : `resolve-reference.ts`, `handlers.ts`, `execute-workflow.ts`, tests associés, durcissement de l'id dans `workflow.ts`.

## 9. Décisions d'architecture à pouvoir défendre

- **Modèle de workflow séparé de React Flow** : le moteur ne dépend pas de l'interface. Une conversion `toGraph()` / `fromGraph()` côté front fera la traduction (`branch` correspond au `sourceHandle`).
- **Validation à deux niveaux** : Zod pour la forme, `validateGraph` pour la structure.
- **Types discriminés** : la `config` de chaque nœud est déduite du `type`.
- **Erreurs retournées, pas lancées** : un résultat typé permet au front d'afficher toutes les erreurs d'un coup, avec des codes stables.
- **Injection du `fetch`** : moteur testable sans réseau.
- **Un statut HTTP n'est pas une erreur du moteur** : sinon la branche « non » d'une condition ne serait jamais exécutée sur un 404.
- **`SKIPPED` distinct de `FAILED`** : l'interface distingue « pas exécuté » de « cassé ».
- **Références sûres** : propriétés propres uniquement, ids sans point.
- **Limites déjà en place** : nombre de nœuds et d'arêtes, timeout par requête, taille maximale de réponse.

## 10. Problèmes rencontrés

- Fichiers vides sur le disque (contenu non sauvegardé dans VS Code) : un `package.json`, puis `workflow.ts`.
- Contenu collé deux fois dans un fichier de test.
- Ancien `eslint.config.js` resté à la racine, lu avant `eslint.config.mjs`.
- Paquet `eslint-config-prettier` non installé au premier essai.
- Chemin du script dans `apps/web/index.html` après le déplacement du projet Vite.
- Dossier `engine` refusé à la suppression par Windows pendant un changement de branche, puis `main` local en retard : réglé avec `git pull --ff-only` et `git rebase main`. La cause probable est OneDrive ou VS Code qui tiennent les fichiers ouverts ; un dépôt dans un dossier local (`C:\dev\flowops`) éviterait ce genre de souci.
- Migration de GitLab vers GitHub : une réécriture locale des emails d'auteur avait changé le hash de tous les commits, si bien que la branche de fonctionnalité n'avait plus d'ancêtre commun avec `main` (conflits sur tous les fichiers). Réglé en rebasant la branche sur le `main` distant, puis en réécrivant les emails une seule fois, sur toutes les branches, avant le premier push vers GitHub.

## 11. Limites connues

- Pas encore de route HTTP pour lancer le moteur : il n'est testé qu'en local.
- **Le nœud HTTP n'est pas protégé contre les requêtes vers des adresses internes (SSRF).** Il ne doit pas être exposé publiquement avant la branche de sécurité.
- La taille de la réponse est vérifiée après lecture complète du corps. Il n'y a pas encore de durée maximale globale d'exécution.
- Aucune persistance : pas de base de données, ni d'historique des exécutions.

## 12. Prochaines étapes

1. **Route `POST /api/run`** : branche le moteur sur l'API, validation d'entrée avec Zod, 400 pour un graphe invalide, 200 avec les résultats par nœud, usage local.
2. **Canvas React Flow** : nœuds personnalisés, panneau de configuration, `toGraph()` / `fromGraph()` avec un store Zustand, bouton « Exécuter » et statuts par nœud. À la fin, le parcours créer → exécuter → voir le résultat fonctionne sans base de données.
3. **Prisma + PostgreSQL** : `User`, `Workflow`, `WorkflowRun` (avec copie du graphe exécuté) et `NodeRun`, migrations, CRUD, historique.
4. **Authentification et isolation des données** par utilisateur.
5. **Sécurité du nœud HTTP** : blocage des adresses locales et privées, revalidation des redirections, lecture de la réponse en flux, durée maximale d'exécution.
6. **Débogage dans l'interface** : historique, détail par nœud (entrée, sortie, durée, erreur), relance.
7. **Tests complémentaires** : cas limites du moteur, tests d'API, tests d'isolation entre utilisateurs.
8. **Déploiement** : Dockerfile, Cloud Run, base managée, frontend sur Firebase Hosting, GitHub Actions avec Workload Identity Federation.
9. **Finitions portfolio** : README, schéma d'architecture, `docs/decisions.md`, trois scénarios de démo (nominal, erreur, modification) et vidéo courte.
