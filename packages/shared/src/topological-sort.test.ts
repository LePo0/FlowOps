import { describe, it, expect } from "vitest";
import { topologicalSort } from "./topological-sort.js";

describe("topologicalSort", () => {
  it("place chaque nœud après ses dépendances (losange)", () => {
    const order = topologicalSort(
      ["a", "b", "c", "d"],
      [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
        { source: "b", target: "d" },
        { source: "c", target: "d" },
      ],
    );
    expect(order).not.toBeNull();
    expect(order?.[0]).toBe("a");
    expect(order?.[3]).toBe("d");
  });

  it("retourne null quand il y a un cycle", () => {
    const order = topologicalSort(
      ["a", "b"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ],
    );
    expect(order).toBeNull();
  });

  it("accepte des nœuds sans arête", () => {
    expect(topologicalSort(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
