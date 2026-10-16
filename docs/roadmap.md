# Roadmap FlowOps

_Dernière mise à jour : 16 octobre 2026._

## Fait

- [x] Monorepo npm workspaces (`apps/web`, `apps/api`, `packages/shared`)
- [x] ESLint, Prettier, validation des variables d'environnement
- [x] CI GitLab (lint, typecheck, tests), `main` protégé
- [x] Schémas Zod du workflow, workflow de démonstration (`packages/shared`)
- [x] `validateGraph` et tri topologique
- [x] Exécution des nœuds (trigger, HTTP, condition, transform), branches, politique d'échec

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

- [ ] Choix de la base (hébergée gratuite, Postgres portable ou service CI)
- [ ] Prisma : `User`, `Workflow`, `WorkflowRun`, `NodeRun`, migrations
- [ ] CRUD des workflows
- [ ] Historique des exécutions

### 4. Authentification

- [ ] Choix : Firebase Auth ou solution maison
- [ ] Isolation des données par utilisateur
- [ ] Tests d'isolation

### 5. Sécurité du nœud HTTP

- [ ] Blocage des adresses locales et privées (SSRF)
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
- [ ] Déploiement via GitLab CI (Workload Identity Federation, pas de clé statique)
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
