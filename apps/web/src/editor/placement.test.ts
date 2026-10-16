import { describe, it, expect } from "vitest";
import type { FlowNode } from "./graph.ts";
import { freePosition, NODE_HEIGHT } from "./placement.ts";

const nodeAt = (id: string, x: number, y: number): FlowNode => ({
  id,
  type: "trigger",
  position: { x, y },
  data: { type: "trigger", name: "Déclencheur", config: {} },
});

describe("freePosition", () => {
  it("garde la position si elle est libre", () => {
    expect(freePosition({ x: 0, y: 0 }, [nodeAt("a", 500, 500)])).toEqual({ x: 0, y: 0 });
  });

  it("descend sous les nœuds qui occupent la zone", () => {
    const nodes = [nodeAt("a", 0, 0), nodeAt("b", 0, 100)];
    const position = freePosition({ x: 0, y: 0 }, nodes);

    expect(position.x).toBe(0);
    expect(position.y).toBeGreaterThanOrEqual(100 + NODE_HEIGHT);
  });

  it("utilise la taille mesurée par React Flow quand elle existe", () => {
    const tall = { ...nodeAt("a", 0, 0), measured: { width: 220, height: 300 } };

    expect(freePosition({ x: 0, y: 0 }, [tall]).y).toBeGreaterThanOrEqual(300);
  });
});
