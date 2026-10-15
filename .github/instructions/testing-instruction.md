---
applyTo: "**/*.{test,spec}.{ts,tsx}"
---

# Tests — FlowOps

## Outils

- Utiliser Vitest pour les tests unitaires.
- Utiliser Supertest pour tester l'API HTTP.
- Utiliser les outils de test React déjà présents dans le projet pour les tests de composants.
- Ne pas ajouter de framework de test supplémentaire sans justification.

## Principes

- Tester le comportement attendu plutôt que les détails d'implémentation.
- Écrire des tests déterministes et indépendants.
- Ne pas dépendre d'une API publique réelle pour les tests unitaires.
- Simuler les appels réseau sortants lorsque cela est approprié.
- Ne pas utiliser de clés, tokens ou données personnelles réels.
- Éviter les attentes arbitraires et les délais artificiels.
- Ne pas désactiver un test en échec sans en comprendre la cause.

## Tests du moteur d'exécution

Couvrir au minimum les situations suivantes :

- Workflow valide avec un seul nœud.
- Workflow vide ou invalide.
- Identifiants de nœuds dupliqués.
- Connexion vers un nœud inexistant.
- Type de nœud inconnu.
- Graphe cyclique.
- Exécution linéaire de plusieurs nœuds.
- Condition vraie et condition fausse.
- Branche non sélectionnée correctement ignorée.
- Réponse HTTP réussie.
- Erreur HTTP, timeout ou réponse invalide.
- Propagation d'une erreur d'exécution.
- Résultats et statuts cohérents pour chaque nœud.

## Tests API

Tester :

- Les réponses des endpoints nominaux.
- Les corps de requête invalides.
- Les ressources inexistantes.
- Les erreurs d'authentification.
- Le refus d'accès aux workflows d'un autre utilisateur.
- Les créations, modifications et suppressions.
- La persistance des exécutions et de leurs résultats.

## Tests de sécurité

- Vérifier que les utilisateurs ne peuvent pas accéder aux données des autres.
- Vérifier que les destinations HTTP interdites sont refusées.
- Vérifier que les limites d'exécution et de taille sont appliquées.
- Vérifier que les erreurs ne révèlent pas de secrets ou de détails internes.

## Organisation

- Placer les tests près du code testé ou dans le répertoire de tests déjà adopté.
- Utiliser des fixtures lisibles et réutilisables.
- Préférer des données de test minimales.
- Nommer les tests de façon à décrire le comportement attendu.

## Exécution

Après une modification :

1. Exécuter les tests ciblés.
2. Corriger les régressions.
3. Exécuter les suites pertinentes.
4. Signaler les tests non exécutés ou les limitations rencontrées.

Ne jamais prétendre qu'une suite de tests est passée sans l'avoir exécutée et vérifiée.
