# FlowOps

Éditeur visuel de workflows d'API : on assemble des nœuds (déclencheur, requête HTTP, condition, transformation) sur un canvas, on exécute le workflow et on voit le résultat de chaque nœud.

> **Statut** : en développement, usage local uniquement. Le nœud HTTP est protégé (politique réseau, voir [docs/security/http-node.md](docs/security/http-node.md)) ; une limite d'exécutions par utilisateur reste à faire avant la mise en ligne (voir la [roadmap](docs/roadmap.md)).

## Démarrage au quotidien

Trois commandes, dans cet ordre, depuis la racine du projet :

```powershell
npm run db:start   # base PostgreSQL locale : à relancer après chaque redémarrage du PC
npm run dev:api    # API sur http://localhost:3000
npm run dev:web    # éditeur sur http://localhost:5173
```

`npm run db:status` indique si la base tourne, `npm run db:stop` l'arrête.

Si l'API affiche « Base de données injoignable », c'est que la base n'a pas été démarrée.

## Fonctionnalités

- **Comptes** (Firebase Authentication) : connexion Google ou email/mot de passe, inscription avec vérification de l'adresse, mot de passe oublié. Chaque utilisateur ne voit que ses workflows et ses exécutions.
- **Canvas** (React Flow) : ajout, connexion et configuration des nœuds ; les connexions impossibles (cycle, arête vers le déclencheur…) sont refusées pendant le tracé.
- **Nœuds** :
  - **Requête HTTP** : méthode, URL, en-têtes, corps, délai ; valeurs issues des nœuds précédents avec `{{http1.body.results.0.url}}`.
  - **Condition** : comparaison stricte, deux sorties « vrai » et « faux ».
  - **Transformation** : filtre des éléments d'une liste, extraction d'un champ (`ability.name` → `["overgrow", …]`), champs à conserver.
- **Exécution** : statut de chaque nœud (réussi, échec, ignoré), sortie, entrée réellement utilisée et détail technique des erreurs.
- **Enregistrement** : nom du workflow, Ctrl+S, « Ouvrir… », « Nouveau » ; le dernier workflow ouvert est rouvert au rechargement de la page.

## Prérequis

- **Node.js 24** ou plus récent.
- **PostgreSQL 18** installé (seuls ses programmes sont utilisés : FlowOps a sa propre instance, sans droits administrateur).

## Première installation

1. Installer les dépendances (génère aussi le client Prisma) :

   ```powershell
   npm install
   ```

2. Créer l'instance PostgreSQL locale (port 5433, données hors de OneDrive), le rôle `flowops` et les bases `flowops` et `flowops_test` : procédure dans [docs/architecture.md, section « Base locale »](docs/architecture.md#base-locale).

3. Créer `apps/api/.env` à partir de [`apps/api/.env.example`](apps/api/.env.example) et y mettre le mot de passe du rôle `flowops` et l'ID du projet Firebase de développement (`FIREBASE_PROJECT_ID`). Ce fichier est ignoré par Git.

4. Créer `apps/web/.env.local` avec la configuration web du projet Firebase : voir [Authentification](#authentification).

5. Appliquer les migrations :

   ```powershell
   npm run db:migrate -w api
   ```

6. Lancer la base, l'API et l'éditeur comme dans [Démarrage au quotidien](#démarrage-au-quotidien).

### Authentification

FlowOps utilise deux projets Firebase : `flowops-dev-…` en local, `flowops-prod-…` pour la mise en ligne. Les comptes de test ne se mélangent jamais avec ceux de production.

Dans la [console Firebase](https://console.firebase.google.com/), pour chaque projet :

1. **Authentication > Sign-in method** : activer **Google** (avec une adresse email d'assistance) et **Adresse e-mail/Mot de passe**.
2. **Authentication > Paramètres > Domaines autorisés** : `localhost` pour le projet de développement, le domaine de l'éditeur pour la production.
3. **Paramètres du projet > Général > Vos applications** : ajouter une application web, puis recopier sa configuration dans `apps/web/.env.local` (ignoré par Git) :

   ```dotenv
   VITE_FIREBASE_API_KEY=AIza…
   VITE_FIREBASE_AUTH_DOMAIN=flowops-dev-xxxx.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=flowops-dev-xxxx
   VITE_FIREBASE_APP_ID=1:…:web:…
   ```

   Ces valeurs ne sont pas secrètes : elles sont servies au navigateur. L'API n'a besoin que de l'ID du projet (`FIREBASE_PROJECT_ID` dans `apps/api/.env`), pour n'accepter que les jetons émis pour celui-ci.

### Appels vers un réseau interne

Par défaut, le nœud HTTP n'appelle que des adresses publiques : `localhost`, les réseaux privés et le serveur de métadonnées du cloud sont refusés (« Adresse non autorisée »). Pour une installation en entreprise, l'administrateur ouvre explicitement des réseaux ou des domaines dans `apps/api/.env` :

```dotenv
HTTP_ALLOWED_TARGETS=10.20.0.0/16,*.interne.entreprise.fr
HTTP_DENIED_TARGETS=10.20.99.0/24   # exclusions, prioritaires (ex. le réseau de la base de FlowOps)
```

La boucle locale et le serveur de métadonnées restent toujours interdits. Règles et scénarios vérifiés : [docs/security/http-node.md](docs/security/http-node.md).

### Vérification de l'adresse email

Les comptes email/mot de passe doivent vérifier leur adresse avant d'accéder à l'éditeur (l'API répond `403` sinon). Les tests n'utilisent pas Firebase : aucune configuration n'est nécessaire pour `npm test` ni en CI.

### Derrière un proxy d'entreprise

`npm run dev:api` démarre Node avec `--use-system-ca` : les requêtes du nœud HTTP passent par les certificats du système, dont celui du proxy. Pour installer ou mettre à jour Prisma derrière ce proxy :

```powershell
$env:NODE_OPTIONS="--use-system-ca"; npm install
```

## Commandes utiles

| Commande                     | Rôle                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `npm test`                   | Tests de tous les paquets (les tests d'intégration utilisent la base `flowops_test`) |
| `npm run typecheck`          | Vérification des types                                                               |
| `npm run lint`               | ESLint                                                                               |
| `npm run format:check`       | Vérifie le formatage Prettier (`npm run format` pour corriger)                       |
| `npm run db:migrate -w api`  | Crée et applique une migration après une modification du schéma Prisma               |
| `npm run db:generate -w api` | Régénère le client Prisma                                                            |

La CI GitHub Actions (`.github/workflows/ci.yml`) lance `lint`, `typecheck`, `test` et `format` sur chaque pull request et sur `main`.

## Structure

```
apps/
  api/        API Express : moteur d'exécution (src/engine), routes, Prisma (prisma/)
  web/        Éditeur React + React Flow + Zustand
packages/
  shared/     Contrat partagé : schémas Zod du workflow et des réponses de l'API
scripts/      Démarrage de la base locale (db.mjs)
docs/         Architecture et roadmap
```

## Documentation

- [Architecture](docs/architecture.md) : modules, moteur, API, éditeur, persistance, limites et sécurité.
- [Roadmap](docs/roadmap.md) : ce qui est fait et la suite, dans l'ordre.
