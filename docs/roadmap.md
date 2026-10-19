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
- Usage local uniquement tant que la sécurité du nœud HTTP n'est pas faite (route non montée si `NODE_ENV=production`)

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
- [ ] Éditeur : écran de connexion (Google, email/mot de passe, inscription, mot de passe oublié), jeton sur chaque appel, déconnexion qui vide l'état local
- [ ] Documentation : configuration Firebase et variables d'environnement

### 5. Sécurité du nœud HTTP

- [ ] Blocage des adresses locales et privées (SSRF), y compris pour les URL construites avec des `{{références}}` : une API tierce peut renvoyer une adresse interne
- [ ] Revalidation des redirections
- [ ] Lecture de la réponse en flux avec limite de taille
- [ ] Durée maximale d'une exécution
- [ ] Secrets hors du graphe et des logs
- **Prérequis avant toute mise en ligne**

### 6. Débogage dans l'interface

- [ ] Historique des exécutions
- [ ] Détail par nœud (entrée, sortie, durée, erreur)
- [ ] Relance d'une exécution

### 7. Tests complémentaires

- [ ] Cas limites du moteur
- [ ] Tests d'API
- [ ] Scénarios : nominal, erreur, modification

### 8. Déploiement

- [ ] Dockerfile de l'API
- [ ] Cloud Run et base managée
- [ ] Frontend sur Firebase Hosting
- [ ] Déploiement via GitHub Actions (Workload Identity Federation, pas de clé statique)
- [ ] Budget et alertes de coût

### 9. Finitions portfolio

- [ ] README
- [ ] `docs/architecture.md` à jour avec un schéma final
- [ ] `docs/decisions.md`
- [ ] Trois scénarios de démonstration
- [ ] Vidéo courte

## Hors périmètre (pistes d'évolution)

Exécution planifiée, webhooks, édition collaborative, organisations et rôles, boucles et exécutions parallèles, retries avancés, catalogue d'intégrations, file de jobs.

## Règle de priorité

Si le temps manque, reporter les finitions de l'interface plutôt que les tests, la sécurité et le déploiement.
