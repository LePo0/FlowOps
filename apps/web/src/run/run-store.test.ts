import { describe, it, expect, vi } from "vitest";
import { demoWorkflow, type RunResult } from "@flowops/shared";
import { fromGraph } from "../editor/graph.ts";
import type { RunOutcome } from "./api.ts";
import { createRunStore } from "./run-store.ts";

const { nodes, edges } = fromGraph(demoWorkflow);

const executed: RunResult = {
  status: "FAILED",
  durationMs: 40,
  nodeResults: [
    { nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 },
    { nodeId: "http1", status: "FAILED", error: "fetch failed", durationMs: 40 },
    { nodeId: "check", status: "SKIPPED", durationMs: 0 },
    { nodeId: "names", status: "SKIPPED", durationMs: 0 },
  ],
};

describe("useRunStore", () => {
  it("envoie le graphe du canvas et indexe les résultats par nœud", async () => {
    const runApi = vi.fn(async (): Promise<RunOutcome> => ({ kind: "executed", result: executed }));
    const store = createRunStore(runApi);

    await store.getState().run(nodes, edges);

    expect(runApi).toHaveBeenCalledWith(demoWorkflow);
    expect(store.getState().running).toBe(false);
    expect(store.getState().resultsByNode["http1"]?.error).toBe("fetch failed");
    expect(store.getState().resultsByNode["names"]?.status).toBe("SKIPPED");
  });

  it("signale les nœuds incomplets sans appeler l'API", async () => {
    const runApi = vi.fn(async (): Promise<RunOutcome> => ({ kind: "executed", result: executed }));
    const store = createRunStore(runApi);
    const incomplete = nodes.map((node) =>
      node.data.type === "http"
        ? { ...node, data: { ...node.data, config: { ...node.data.config, url: "" } } }
        : node,
    );

    await store.getState().run(incomplete, edges);

    expect(runApi).not.toHaveBeenCalled();
    expect(store.getState().outcome).toEqual({
      kind: "rejected",
      errors: [
        {
          code: "INCOMPLETE_NODE",
          message: "« GET produits » est incomplet : URL",
          nodeId: "http1",
        },
      ],
    });
  });

  it("indique l'exécution en cours et ignore un second lancement", async () => {
    let finish: (outcome: RunOutcome) => void = () => {};
    const runApi = vi.fn(() => new Promise<RunOutcome>((resolve) => (finish = resolve)));
    const store = createRunStore(runApi);

    const first = store.getState().run(nodes, edges);
    expect(store.getState().running).toBe(true);
    await store.getState().run(nodes, edges);
    finish({ kind: "executed", result: executed });
    await first;

    expect(runApi).toHaveBeenCalledTimes(1);
    expect(store.getState().running).toBe(false);
  });

  it("efface les résultats précédents quand l'API refuse le workflow", async () => {
    const outcomes: RunOutcome[] = [
      { kind: "executed", result: executed },
      { kind: "rejected", errors: [{ code: "CYCLE", message: "Le workflow contient un cycle" }] },
    ];
    const store = createRunStore(
      async () => outcomes.shift() ?? { kind: "unavailable", message: "" },
    );

    await store.getState().run(nodes, edges);
    await store.getState().run(nodes, edges);

    expect(store.getState().resultsByNode).toEqual({});
    expect(store.getState().outcome?.kind).toBe("rejected");
  });
});
