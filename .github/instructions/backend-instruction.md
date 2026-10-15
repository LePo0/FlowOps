---
applyTo: "apps/api/**/*.{ts,tsx}"
---

# Backend — FlowOps

## Stack et conventions

- Utiliser Node.js, TypeScript strict et Express.
- Utiliser Zod pour valider les données reçues à l'exécution.
- Utiliser Prisma pour les accès à PostgreSQL.
- Éviter `any`, les assertions de types injustifiées et les abstractions prématurées.
- Vérifier les versions des dépendances et les conventions déjà utilisées avant de modifier le code.

## Architecture

Séparer les responsabilités entre :

- routes HTTP ;
- contrôleurs ;
- services métier ;
- validation des entrées ;
- accès aux données ;
- moteur d'exécution des workflows ;
- handlers spécifiques à chaque type de nœud ;
- gestion centralisée des erreurs.

Les routes et contrôleurs doivent rester minces : valider la requête, appeler le service approprié et construire la réponse HTTP.

Le moteur d'exécution ne doit dépendre ni d'Express, ni de React, ni de React Flow. Il doit recevoir un modèle de workflow validé et retourner un résultat structuré.

Ne pas introduire une architecture en microservices pour le MVP.

## API REST

- Respecter les méthodes et codes de statut HTTP.
- Valider les paramètres de route, les query strings et les corps de requête.
- Définir des réponses d'erreur cohérentes.
- Ne jamais exposer les stack traces ou détails internes en production.
- Appliquer l'authentification et les contrôles de propriété sur chaque opération sensible.
- Ne pas considérer un identifiant difficile à deviner comme un mécanisme d'autorisation.
- Limiter la taille des requêtes entrantes.

## Moteur d'exécution

Le MVP prend en charge les types de nœuds suivants :

- `httpRequest` : requête HTTP sortante.
- `condition` : comparaison déterministe et sélection d'une branche.
- `transform` : transformation JSON déclarative.

Chaque type de nœud doit disposer :

- d'un schéma de configuration validé ;
- d'un contrat d'entrée et de sortie explicite ;
- d'un handler responsable de son exécution ;
- d'une gestion des erreurs prévisible.

Le moteur doit :

1. Valider le graphe avant son exécution.
2. Vérifier les identifiants et les connexions.
3. Détecter les cycles et les refuser dans le MVP.
4. Déterminer l'ordre d'exécution des dépendances.
5. Exécuter uniquement les branches sélectionnées.
6. Enregistrer les statuts, durées, résultats et erreurs.
7. Terminer l'exécution avec un statut cohérent.

Ne pas utiliser `eval`, `Function` ou un mécanisme similaire pour exécuter du code fourni par l'utilisateur.

## Appels HTTP sortants et sécurité

- Limiter les protocoles autorisés, idéalement à HTTP et HTTPS.
- Mettre en place des protections SSRF contre les adresses loopback, privées, link-local et les endpoints de métadonnées cloud.
- Revalider les destinations après résolution DNS et lors des redirections.
- Refuser les redirections vers des destinations interdites.
- Appliquer un timeout et une limite de taille à chaque réponse.
- Limiter le nombre de nœuds, la taille du graphe et la durée totale d'une exécution.
- Ne jamais journaliser les tokens, cookies, secrets ou en-têtes sensibles.
- Ne pas exposer de secrets dans les sorties des nœuds.

Si les protections nécessaires ne sont pas implémentées, ne pas rendre l'exécution de requêtes arbitraires accessible publiquement.

## Gestion des erreurs et asynchronisme

- Centraliser la gestion des erreurs applicatives.
- Ne jamais masquer une erreur avec un `catch` vide.
- Ne pas retourner un résultat réussi lorsqu'une étape a échoué.
- Distinguer les erreurs de validation, d'autorisation, de configuration et d'exécution.
- Gérer les opérations asynchrones et leur cycle de vie explicitement.
- Utiliser des transactions lorsque plusieurs écritures doivent rester cohérentes.

## Tests et documentation

- Tester le moteur indépendamment de l'API HTTP.
- Ajouter des tests pour les cas nominaux, les erreurs et les limites.
- Tester les permissions et l'isolation des utilisateurs.
- Documenter les variables d'environnement dans `.env.example`, sans valeur secrète.
- Vérifier le typage et les tests pertinents après chaque modification significative.
