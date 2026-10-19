import type { RunDetail, RunSummary, WorkflowGraph } from "@flowops/shared";
import { create } from "zustand";
import type { RunOutcome } from "../run/api.ts";
import type { RunsApi } from "./api.ts";

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export interface HistoryState {
  workflowId: string | null;
  runs: Loadable<RunSummary[]>;
  selectedId: string | null;
  detail: Loadable<RunDetail>;
  replaying: boolean;
  replayError: string | null;
  // Charge l'historique d'un workflow enregistré et affiche l'exécution la plus récente
  open: (workflowId: string) => Promise<void>;
  select: (runId: string) => Promise<void>;
  // Rejoue la copie du graphe de l'exécution affichée, telle qu'elle a tourné
  replay: () => Promise<void>;
}

export interface HistoryDeps {
  api: RunsApi;
  // Exécute un graphe et l'ajoute à l'historique du workflow (POST /api/workflows/:id/runs)
  runGraph: (graph: WorkflowGraph, workflowId: string) => Promise<RunOutcome>;
}

export function createHistoryStore({ api, runGraph }: HistoryDeps) {
  return create<HistoryState>()((set, get) => {
    const loadRuns = async (workflowId: string) => {
      const result = await api.list(workflowId);
      // Un autre workflow a été ouvert entre-temps : réponse périmée
      if (get().workflowId !== workflowId) return null;
      set({
        runs: result.ok
          ? { status: "ready", data: result.data }
          : { status: "error", message: result.message },
      });
      return result.ok ? result.data : null;
    };

    return {
      workflowId: null,
      runs: { status: "idle" },
      selectedId: null,
      detail: { status: "idle" },
      replaying: false,
      replayError: null,

      open: async (workflowId) => {
        set({
          workflowId,
          runs: { status: "loading" },
          selectedId: null,
          detail: { status: "idle" },
          replayError: null,
        });
        const runs = await loadRuns(workflowId);
        const latest = runs?.[0];
        if (latest) await get().select(latest.id);
      },

      select: async (runId) => {
        set({ selectedId: runId, detail: { status: "loading" }, replayError: null });
        const result = await api.get(runId);
        // Clic sur une autre exécution pendant le chargement : on garde la plus récente demande
        if (get().selectedId !== runId) return;
        set({
          detail: result.ok
            ? { status: "ready", data: result.data }
            : { status: "error", message: result.message },
        });
      },

      replay: async () => {
        const { workflowId, detail, replaying } = get();
        if (replaying || workflowId === null || detail.status !== "ready") return;

        set({ replaying: true, replayError: null });
        let outcome: RunOutcome;
        try {
          outcome = await runGraph(detail.data.graph, workflowId);
        } catch {
          outcome = { kind: "unavailable", message: "Erreur inattendue pendant la relance." };
        }
        set({ replaying: false });

        if (outcome.kind === "executed" && outcome.runId !== undefined) {
          // La nouvelle exécution apparaît en tête de liste et s'affiche
          await loadRuns(workflowId);
          await get().select(outcome.runId);
          return;
        }
        set({
          replayError:
            outcome.kind === "rejected"
              ? `Relance refusée : ${outcome.errors.map((error) => error.message).join(" ; ")}`
              : outcome.kind === "unavailable"
                ? `Relance impossible : ${outcome.message}`
                : "Relance effectuée, mais non enregistrée dans l'historique.",
        });
      },
    };
  });
}
