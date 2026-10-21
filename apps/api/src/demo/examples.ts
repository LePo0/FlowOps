import { demoWorkflow, type SaveWorkflowRequest } from "@flowops/shared";

// Workflows créés pour chaque nouvelle session de démo (scénarios E1 à E3 de
// docs/security/demo-sessions.md). Les API appelées sont publiques et leurs réponses restent sous
// la limite de taille des sessions de démo (300 Ko).
export const DEMO_EXAMPLES: SaveWorkflowRequest[] = [
  { name: "Exemple 1 — Produits en stock", graph: demoWorkflow },
  {
    name: "Exemple 2 — Pokémon : références entre nœuds",
    graph: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          name: "Démarrage manuel",
          position: { x: 0, y: 100 },
          config: {},
        },
        {
          id: "species",
          type: "http",
          name: "GET espèce",
          position: { x: 250, y: 100 },
          config: { method: "GET", url: "https://pokeapi.co/api/v2/pokemon-species/1" },
        },
        {
          id: "frName",
          type: "transform",
          name: "Nom en français",
          position: { x: 500, y: 0 },
          config: {
            source: "species.body.names",
            filter: { field: "language.name", operator: "eq", value: "fr" },
            extract: "name",
          },
        },
        {
          id: "chain",
          type: "http",
          name: "GET chaîne d'évolution",
          position: { x: 500, y: 200 },
          // URL lue dans la réponse précédente
          config: { method: "GET", url: "{{species.body.evolution_chain.url}}" },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "species" },
        { id: "e2", source: "species", target: "frName" },
        { id: "e3", source: "species", target: "chain" },
      ],
    },
  },
  {
    name: "Exemple 3 — Erreur à corriger",
    graph: {
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          name: "Démarrage manuel",
          position: { x: 0, y: 100 },
          config: {},
        },
        {
          id: "product",
          type: "http",
          name: "GET produit",
          position: { x: 250, y: 100 },
          config: { method: "GET", url: "https://dummyjson.com/products/1" },
        },
        {
          id: "related",
          type: "http",
          name: "GET même catégorie",
          position: { x: 500, y: 100 },
          // Erreur volontaire : le champ s'appelle « category ». L'historique montre la
          // référence vide ; le visiteur corrige l'URL et relance.
          config: {
            method: "GET",
            url: "https://dummyjson.com/products/category/{{product.body.categorie}}?limit=5",
          },
        },
        {
          id: "titles",
          type: "transform",
          name: "Titres",
          position: { x: 750, y: 100 },
          config: { source: "related.body.products", extract: "title" },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "product" },
        { id: "e2", source: "product", target: "related" },
        { id: "e3", source: "related", target: "titles" },
      ],
    },
  },
];
