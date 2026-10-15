---
applyTo: ".github/workflows/**/*,Dockerfile*,docker-compose*.yml,**/*.yaml,**/*.yml,infra/**/*"
---

# Déploiement et CI/CD — FlowOps

## Architecture cible

Le déploiement envisagé utilise :

- Frontend React statique sur Firebase Hosting.
- API Node.js conteneurisée sur Google Cloud Run.
- PostgreSQL managé sur Google Cloud SQL.
- GitHub Actions pour les vérifications automatisées et le déploiement.

Cette architecture est une cible. Ne crée pas de ressources cloud et ne lance pas de déploiement sans demande explicite.

## Docker

- Utiliser une image adaptée à la version de Node.js du projet.
- Préférer une image de production minimale.
- Installer les dépendances de manière reproductible à partir du lockfile.
- Ne pas inclure les fichiers `.env` ou secrets dans l'image.
- Exécuter le processus avec des privilèges minimaux lorsque possible.
- Configurer correctement le port fourni par l'environnement d'hébergement.
- Vérifier que l'application démarre et répond à un health check.
- Ne pas lancer automatiquement des migrations destructrices au démarrage de chaque instance.

## GitHub Actions

Les workflows CI doivent vérifier, selon le périmètre concerné :

- L'installation reproductible des dépendances.
- Le lint.
- Le typage TypeScript.
- Les tests.
- Le build frontend et backend.
- La construction de l'image Docker lorsqu'elle est pertinente.

- Utiliser des versions d'actions maintenues et explicites.
- Définir les permissions minimales nécessaires.
- Éviter de lancer des déploiements de production depuis chaque branche ou pull request.
- Séparer les vérifications CI du déploiement.
- Ne pas masquer les erreurs de commandes.

## Google Cloud

- Utiliser des identités de service avec les permissions minimales.
- Privilégier Workload Identity Federation pour l'authentification GitHub Actions vers Google Cloud.
- Ne pas versionner de clé de service Google Cloud.
- Stocker les secrets dans un gestionnaire adapté, par exemple Secret Manager.
- Configurer les variables d'environnement par environnement.
- Restreindre les accès réseau et les autorisations de la base.
- Configurer des limites et un budget pour éviter les dépenses inattendues.

## PostgreSQL et migrations

- Utiliser les migrations Prisma pour faire évoluer le schéma.
- Exécuter les migrations de manière contrôlée avant que la nouvelle version de l'application en dépende.
- Éviter les modifications incompatibles avec la version actuellement en production.
- Ne pas utiliser `prisma db push` comme mécanisme de déploiement en production.
- Documenter les procédures de migration et de retour arrière lorsque cela est possible.

## Configuration et observabilité

- Maintenir un `.env.example` avec les noms des variables et des valeurs factices.
- Ne jamais exposer les secrets dans les logs.
- Produire des logs exploitables sans inclure de données sensibles.
- Distinguer les environnements local, test et production.
- Configurer les timeouts, health checks et limites adaptés à l'application.
- Documenter les commandes de déploiement, les ressources nécessaires et les opérations de nettoyage.

## Coûts et validation

- Vérifier les coûts et limites des offres cloud avant de créer des ressources.
- Ne pas supposer qu'un service est gratuit.
- Ne pas créer automatiquement des bases, buckets, services ou autres ressources payantes.
- Après un déploiement, vérifier le résultat réel et signaler les éventuelles étapes manuelles restantes.
- Ne jamais annoncer un déploiement réussi sans vérification.
