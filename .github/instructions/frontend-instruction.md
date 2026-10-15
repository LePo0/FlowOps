---
applyTo: "apps/web/**/*.{ts,tsx}"
---

# Frontend — FlowOps

## Stack et conventions

- Utiliser React, TypeScript strict, Vite et `@xyflow/react`.
- Utiliser les composants fonctionnels et les hooks React.
- Utiliser TanStack Query pour les données provenant de l'API.
- Utiliser Zustand uniquement pour les états partagés entre plusieurs composants lorsque cela est justifié.
- Réutiliser les dépendances et conventions déjà présentes dans le projet. Ne pas ajouter de dépendance sans besoin concret.
- Éviter `any`. Préférer des types explicites, des unions discriminées et `unknown` accompagné d'une validation.

## Architecture frontend

Séparer les responsabilités entre :

- les pages et la navigation ;
- l'éditeur de workflow ;
- les composants de nœuds React Flow ;
- les formulaires de configuration ;
- les services d'accès à l'API ;
- les hooks métier ;
- les types partagés.

Éviter les composants trop volumineux qui mélangent rendu, appels API et logique métier.

## React Flow

- Utiliser `@xyflow/react` pour l'édition et la visualisation des workflows.
- Créer des composants personnalisés pour les types de nœuds du MVP : `httpRequest`, `condition` et `transform`.
- Définir des handles cohérents avec les entrées et sorties de chaque type de nœud.
- Utiliser des identifiants stables pour les nœuds et les arêtes.
- Conserver dans le graphe uniquement des données sérialisables : identifiants, types, positions, configurations et connexions.
- Ne jamais persister des callbacks, références DOM ou objets runtime.
- Séparer les données du workflow des états temporaires de l'interface.
- Utiliser les mécanismes de validation des connexions de React Flow pour améliorer l'expérience utilisateur.
- Considérer toute validation côté frontend comme une aide ergonomique : le backend doit toujours valider le graphe avant son exécution.
- Vérifier l'API de la version installée de React Flow avant d'utiliser un hook ou une propriété.

## Gestion des données et des états

- Utiliser TanStack Query pour le chargement, la mise en cache et l'invalidation des données distantes.
- Ne pas dupliquer les données serveur dans Zustand sans justification.
- Gérer explicitement les états de chargement, de succès, de liste vide et d'erreur.
- Éviter les effets React utilisés pour calculer des valeurs qui peuvent être dérivées directement du state ou des props.
- Nettoyer les abonnements et les effets lorsqu'un composant est démonté.
- Ne pas considérer les données reçues du frontend comme fiables du seul fait qu'elles sont typées en TypeScript.

## Exécution et débogage

- Le frontend configure les workflows et affiche les résultats ; le backend fait autorité pour leur validation et leur exécution.
- Afficher clairement les statuts des nœuds : en attente, en cours, succès, échec ou ignoré.
- Permettre de consulter les résultats et erreurs de chaque étape.
- Ne pas afficher de secrets, tokens ou en-têtes d'authentification dans les panneaux de débogage.
- Ne pas simuler un résultat d'exécution comme s'il provenait réellement du backend.

## Qualité et accessibilité

- Privilégier les composants réutilisables et les responsabilités explicites.
- Fournir des labels et des messages d'erreur compréhensibles.
- Ne pas transmettre une information uniquement par la couleur.
- Prévoir des états de focus visibles et une utilisation au clavier lorsque cela est pertinent.
- Tester les comportements importants plutôt que les détails d'implémentation.
- Vérifier le typage et le build frontend après les modifications pertinentes.
