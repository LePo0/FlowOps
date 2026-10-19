import { describe, it, expect, vi } from "vitest";
import { sampleWorkflow, type RunDetail, type RunSummary } from "@flowops/shared";
import type { ApiResult } from "../api/request.ts";
import type { RunOutcome } from "../run/api.ts";
import type { RunsApi } from "./api.ts";
import { createHistoryStore, type HistoryDeps } from "./history-store.ts";

const WORKFLOW = "40dceb9b-d6f8-413e-8d04-80ebd7f7f49d";
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });

const summary = (id: string, status: RunSummary["status"] = "SUCCESS"): RunSummary => ({
  id,
  workflowId: WORKFLOW,
  status,
  startedAt: "2026-10-19T14:00:00.000Z",
  durationMs: 12,
});
const detail = (id: string): RunDetail => ({
  ...summary(id),
  graph: sampleWorkflow,
  nodeResults: [{ nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 }],
});

function fakeApi(runs: RunSummary[] = [summary("run-2"), summary("run-1", "FAILED")]) {
  return {
    list: vi.fn<RunsApi["list"]>(async () => ok(runs)),
    get: vi.fn<RunsApi["get"]>(async (id) => ok(detail(id))),
  };
}

function setup(api = fakeApi(), runGraph = vi.fn<HistoryDeps["runGraph"]>()) {
  return { store: createHistoryStore({ api, runGraph }), api, runGraph };
}

describe("store de l'historique", () => {
  it("charge les exécutions et affiche la plus récente", async () => {
    const { store, api } = setup();

    await store.getState().open(WORKFLOW);

    expect(api.list).toHaveBeenCalledWith(WORKFLOW);
    expect(store.getState().runs).toMatchObject({ status: "ready", data: [{ id: "run-2" }, {}] });
    expect(store.getState().selectedId).toBe("run-2");
    expect(store.getState().detail).toMatchObject({ status: "ready", data: { id: "run-2" } });
  });

  it("n'appelle pas le détail quand l'historique est vide", async () => {
    const { store, api } = setup(fakeApi([]));

    await store.getState().open(WORKFLOW);

    expect(store.getState().runs).toEqual({ status: "ready", data: [] });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("affiche l'erreur de chargement de la liste", async () => {
    const api = fakeApi();
    api.list.mockResolvedValueOnce({ ok: false, message: "Workflow introuvable" });
    const { store } = setup(api);

    await store.getState().open(WORKFLOW);

    expect(store.getState().runs).toEqual({ status: "error", message: "Workflow introuvable" });
  });

  it("garde la dernière exécution demandée si les réponses arrivent dans le désordre", async () => {
    const api = fakeApi();
    let releaseFirst: () => void = () => {};
    api.get.mockImplementationOnce(
      (id) => new Promise((resolve) => (releaseFirst = () => resolve(ok(detail(id))))),
    );
    const { store } = setup(api);

    const slow = store.getState().select("run-1");
    await store.getState().select("run-2");
    releaseFirst();
    await slow;

    expect(store.getState().detail).toMatchObject({ status: "ready", data: { id: "run-2" } });
  });

  it("relance la copie du graphe stockée, puis affiche la nouvelle exécution", async () => {
    const api = fakeApi();
    const runGraph = vi.fn(async (): Promise<RunOutcome> => ({
      kind: "executed",
      result: { status: "SUCCESS", nodeResults: [], durationMs: 5 },
      runId: "run-3",
    }));
    const { store } = setup(api, runGraph);
    await store.getState().open(WORKFLOW);
    api.list.mockResolvedValueOnce(ok([summary("run-3"), summary("run-2"), summary("run-1")]));

    await store.getState().replay();

    expect(runGraph).toHaveBeenCalledWith(sampleWorkflow, WORKFLOW);
    expect(store.getState()).toMatchObject({ replaying: false, selectedId: "run-3" });
    expect(store.getState().runs).toMatchObject({
      status: "ready",
      data: [{ id: "run-3" }, {}, {}],
    });
  });

  it("explique un refus de la relance sans quitter l'exécution affichée", async () => {
    const runGraph = vi.fn(async (): Promise<RunOutcome> => ({
      kind: "rejected",
      errors: [{ code: "INCOMPLETE_NODE", message: "« Requête » est incomplet" }],
    }));
    const { store } = setup(fakeApi(), runGraph);
    await store.getState().open(WORKFLOW);

    await store.getState().replay();

    expect(store.getState().replayError).toBe("Relance refusée : « Requête » est incomplet");
    expect(store.getState().selectedId).toBe("run-2");
  });

  it("ne relance rien tant qu'aucune exécution n'est affichée", async () => {
    const { store, runGraph } = setup(fakeApi([]));
    await store.getState().open(WORKFLOW);

    await store.getState().replay();

    expect(runGraph).not.toHaveBeenCalled();
  });
});
