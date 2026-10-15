import { describe, it, expect } from "vitest";
import { demoWorkflow } from "@flowops/shared";
import { validateGraph } from "./validate-graph.js";
import type { ValidationResult } from "./types.js";

function errorCodes(result: ValidationResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}

describe("validateGraph", () => {
  it("accepte le workflow de démonstration", () => {
    expect(validateGraph(demoWorkflow).ok).toBe(true);
  });

  it("rejette une forme invalide", () => {
    expect(errorCodes(validateGraph({ nodes: "x" }))).toContain("INVALID_SHAPE");
  });

  it("détecte un identifiant de nœud en double", () => {
    const graph = structuredClone(demoWorkflow);
    graph.nodes.push({
      id: "http1",
      type: "transform",
      name: "Doublon",
      position: { x: 0, y: 0 },
      config: { source: "a.b" },
    });
    expect(errorCodes(validateGraph(graph))).toContain("DUPLICATE_NODE_ID");
  });

  it("détecte une arête vers un nœud inexistant", () => {
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e9", source: "check", target: "fantome", branch: "false" });
    expect(errorCodes(validateGraph(graph))).toContain("UNKNOWN_NODE");
  });

  it("exige un déclencheur", () => {
    const graph = structuredClone(demoWorkflow);
    graph.nodes = graph.nodes.filter((node) => node.type !== "trigger");
    graph.edges = graph.edges.filter((edge) => edge.source !== "trigger");
    expect(errorCodes(validateGraph(graph))).toContain("TRIGGER_COUNT");
  });

  it("refuse deux déclencheurs", () => {
    const graph = structuredClone(demoWorkflow);
    graph.nodes.push({
      id: "t2",
      type: "trigger",
      name: "Second déclencheur",
      position: { x: 0, y: 0 },
      config: {},
    });
    expect(errorCodes(validateGraph(graph))).toContain("TRIGGER_COUNT");
  });

  it("refuse une arête entrante sur le déclencheur", () => {
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e4", source: "names", target: "trigger" });
    expect(errorCodes(validateGraph(graph))).toContain("TRIGGER_HAS_INCOMING_EDGE");
  });

  it("exige une branche sur les sorties d'une condition", () => {
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e4", source: "check", target: "names" });
    expect(errorCodes(validateGraph(graph))).toContain("INVALID_BRANCH");
  });

  it("refuse une branche qui ne part pas d'une condition", () => {
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e4", source: "http1", target: "names", branch: "true" });
    expect(errorCodes(validateGraph(graph))).toContain("INVALID_BRANCH");
  });

  it("détecte un cycle", () => {
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e4", source: "names", target: "http1" });
    expect(errorCodes(validateGraph(graph))).toContain("CYCLE");
  });
});
