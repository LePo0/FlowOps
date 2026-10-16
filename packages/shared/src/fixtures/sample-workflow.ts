import type { WorkflowGraph } from "../workflow.js";

// Graphe figé pour les tests : ne pas modifier sans mettre à jour les tests qui en dépendent.
// La démo de l'éditeur (demo-workflow.ts) peut, elle, évoluer librement.
export const sampleWorkflow: WorkflowGraph = {
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      name: "Démarrage manuel",
      position: { x: 0, y: 100 },
      config: {},
    },
    {
      id: "http1",
      type: "http",
      name: "GET produits",
      position: { x: 250, y: 100 },
      config: { method: "GET", url: "https://dummyjson.com/products" },
    },
    {
      id: "check",
      type: "condition",
      name: "Statut 200 ?",
      position: { x: 500, y: 100 },
      config: { left: "http1.status", operator: "eq", right: 200 },
    },
    {
      id: "names",
      type: "transform",
      name: "Extraire les noms",
      position: { x: 750, y: 0 },
      config: { source: "http1.body.products", pick: ["title"] },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", target: "http1" },
    { id: "e2", source: "http1", target: "check" },
    { id: "e3", source: "check", target: "names", branch: "true" },
  ],
};
