import { describe, it, expect } from "vitest";
import { MAX_NODES, WorkflowGraphSchema, demoWorkflow } from "./index.js";

describe("WorkflowGraphSchema", () => {
  it("accepte le workflow de démonstration", () => {
    expect(WorkflowGraphSchema.safeParse(demoWorkflow).success).toBe(true);
  });

  it("rejette un type de nœud inconnu", () => {
    const bad = {
      ...demoWorkflow,
      nodes: [{ ...demoWorkflow.nodes[0], type: "inconnu" }],
    };
    expect(WorkflowGraphSchema.safeParse(bad).success).toBe(false);
  });

  it("rejette une méthode HTTP invalide", () => {
    const bad = {
      nodes: [
        {
          id: "h",
          type: "http",
          name: "Appel",
          position: { x: 0, y: 0 },
          config: { method: "FETCH", url: "https://example.com" },
        },
      ],
      edges: [],
    };
    expect(WorkflowGraphSchema.safeParse(bad).success).toBe(false);
  });

  it("rejette un graphe qui dépasse la limite de nœuds", () => {
    const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({
      id: `t${i}`,
      type: "trigger",
      name: "Trigger",
      position: { x: 0, y: 0 },
      config: {},
    }));
    expect(WorkflowGraphSchema.safeParse({ nodes, edges: [] }).success).toBe(false);
  });

  it("rejette un identifiant de nœud contenant un point", () => {
    const bad = {
      ...demoWorkflow,
      nodes: [{ ...demoWorkflow.nodes[0], id: "a.b" }],
    };
    expect(WorkflowGraphSchema.safeParse(bad).success).toBe(false);
  });
});
