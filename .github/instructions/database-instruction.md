---
applyTo: "apps/api/prisma/**/*,apps/api/src/**/*.{ts,tsx}"
---

# Base de données — FlowOps

## Stack

- Utiliser PostgreSQL comme base relationnelle.
- Utiliser Prisma comme ORM et système de migrations.
- Utiliser les types générés par Prisma plutôt que de recréer manuellement les types des modèles.
- Privilégier Prisma pour les requêtes courantes.
- Utiliser du SQL brut uniquement lorsqu'un besoin concret le justifie, avec des requêtes paramétrées.

## Modèle métier

Les entités principales du MVP sont :

- `User` : utilisateur et propriétaire des données.
- `Workflow` : définition et configuration du workflow.
- `WorkflowRun` : historique d'une exécution.
- `NodeRun` : résultat d'un nœud au cours d'une exécution.

Chaque workflow appartient à un utilisateur. Chaque exécution appartient à un workflow. Chaque résultat de nœud appartient à une exécution.

Ne pas ajouter de tables ou de relations sans besoin métier identifié.

## Modélisation

- Utiliser des relations explicites et des clés étrangères.
- Définir les contraintes d'intégrité nécessaires.
- Ajouter des index en fonction des requêtes courantes.
- Définir des règles de suppression cohérentes avec la conservation de l'historique.
- Utiliser des dates explicites pour la création et la mise à jour des entités.
- Définir des statuts d'exécution contrôlés et documentés.
- Éviter les colonnes redondantes qui peuvent diverger de la source de vérité.

## Graphes et JSONB

- Stocker la définition du graphe dans un champ JSON adapté au modèle Prisma.
- Le document doit contenir uniquement des données sérialisables.
- Ne pas stocker de fonctions, références runtime ou objets propres au navigateur.
- Valider le document avec Zod avant sa persistance et avant son exécution.
- Limiter sa taille et le nombre de nœuds.
- Conserver un snapshot du graphe dans chaque `WorkflowRun` pour préserver le contexte historique.
- Éviter de dupliquer inutilement les mêmes résultats dans plusieurs entités.

## Sécurité et isolation

- Chaque accès à un workflow doit être limité au propriétaire authentifié.
- Ne jamais charger une ressource puis supposer que son identifiant suffit pour autoriser l'accès.
- Vérifier les droits dans les services métier concernés.
- Ne pas stocker les tokens ou secrets d'API en clair dans les graphes, snapshots, résultats ou logs.
- Ne pas enregistrer de données sensibles qui ne sont pas nécessaires au débogage.

## Migrations Prisma

- Toute modification de `schema.prisma` doit être accompagnée d'une migration.
- Utiliser des noms de migration descriptifs.
- Vérifier la migration sur une base de développement.
- Ne pas modifier manuellement une migration déjà partagée ou appliquée sans stratégie explicite.
- Ne pas utiliser `prisma db push` comme stratégie de migration en production.
- Examiner l'impact sur les données existantes avant toute suppression ou modification de colonne.
- Vérifier que les migrations sont compatibles avec la procédure de déploiement.

## Transactions et performances

- Utiliser une transaction lorsque plusieurs écritures doivent réussir ou échouer ensemble.
- Éviter les requêtes répétées dans des boucles lorsqu'une requête groupée est possible.
- Sélectionner uniquement les champs nécessaires.
- Ne pas charger l'intégralité de l'historique sans pagination ou limite.
- Définir une politique de conservation des exécutions si le volume de données augmente.

## Vérifications

Après une modification de schéma :

1. Vérifier le schéma Prisma.
2. Générer la migration.
3. Régénérer le client Prisma si nécessaire.
4. Exécuter les tests pertinents.
5. Documenter toute modification incompatible.
