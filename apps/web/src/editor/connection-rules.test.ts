import { describe, it, expect } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { canConnect } from "./connection-rules.ts";
import { fromGraph } from "./graph.ts";

// Démo : trigger → http1 → check →(true) names
const { nodes, edges } = fromGraph(sampleWorkflow);

function connect(source: string, target: string, sourceHandle: string | null = null) {
  return canConnect({ source, target, sourceHandle }, nodes, edges);
}

describe("canConnect", () => {
  it("accepte la sortie libre d'une condition vers un nœud en aval", () => {
    expect(connect("check", "names", "false")).toBe(true);
  });

  it("accepte plusieurs entrées sur un même nœud", () => {
    expect(connect("trigger", "names")).toBe(true);
  });

  it("refuse une boucle sur le même nœud", () => {
    expect(connect("http1", "http1")).toBe(false);
  });

  it("refuse une arête vers le déclencheur", () => {
    expect(connect("http1", "trigger")).toBe(false);
  });

  it("refuse une sortie de condition sans branche", () => {
    expect(connect("check", "names")).toBe(false);
  });

  it("refuse une branche sur un nœud qui n'est pas une condition", () => {
    expect(connect("http1", "names", "true")).toBe(false);
  });

  it("refuse une arête en double", () => {
    expect(connect("trigger", "http1")).toBe(false);
    expect(connect("check", "names", "true")).toBe(false);
  });

  it("refuse une arête qui crée un cycle", () => {
    expect(connect("names", "http1")).toBe(false);
  });

  it("refuse un nœud inconnu", () => {
    expect(connect("http1", "inconnu")).toBe(false);
  });
});
