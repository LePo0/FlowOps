import { describe, it, expect } from "vitest";
import { sampleWorkflow, WorkflowGraphSchema } from "@flowops/shared";
import { fromGraph, toGraph, type FlowNode } from "./graph.ts";

describe("fromGraph / toGraph", () => {
  it("fait l'aller-retour sur le workflow d'exemple sans perte", () => {
    const { nodes, edges } = fromGraph(sampleWorkflow);

    expect(toGraph(nodes, edges)).toEqual(sampleWorkflow);
  });

  it("produit un graphe accepté par le schéma partagé", () => {
    const { nodes, edges } = fromGraph(sampleWorkflow);

    expect(WorkflowGraphSchema.safeParse(toGraph(nodes, edges)).success).toBe(true);
  });

  it("convertit la branche d'une arête en poignée de sortie, et inversement", () => {
    const { edges } = fromGraph(sampleWorkflow);

    expect(edges.find((edge) => edge.id === "e3")?.sourceHandle).toBe("true");
    expect(edges.find((edge) => edge.id === "e1")).not.toHaveProperty("sourceHandle");
  });

  it("ignore les champs propres à React Flow", () => {
    const { nodes, edges } = fromGraph(sampleWorkflow);
    const decorated: FlowNode[] = nodes.map((node) => ({
      ...node,
      selected: true,
      dragging: false,
      measured: { width: 120, height: 40 },
    }));
    const decoratedEdges = edges.map((edge) => ({ ...edge, selected: true, animated: true }));

    expect(toGraph(decorated, decoratedEdges)).toEqual(sampleWorkflow);
  });

  it("ignore une poignée de sortie qui n'est pas une branche", () => {
    const graph = toGraph([], [{ id: "e1", source: "a", target: "b", sourceHandle: "out" }]);

    expect(graph.edges).toEqual([{ id: "e1", source: "a", target: "b" }]);
  });
});
