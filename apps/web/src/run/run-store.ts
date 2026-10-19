import type { ApiError, NodeResult, WorkflowGraph } from "@flowops/shared";
import { create } from "zustand";
import { toGraph, type FlowEdge, type FlowNode } from "../editor/graph.ts";
import { validateNode } from "../editor/panel/form-values.ts";
import { postRun, type RunOutcome } from "./api.ts";

export interface RunState {
  running: boolean;
  outcome: RunOutcome | null;
  resultsByNode: Partial<Record<string, NodeResult>>;
  run: (nodes: FlowNode[], edges: FlowEdge[]) => Promise<void>;
  // Efface le dernier résultat (ex. quand un autre workflow est ouvert)
  reset: () => void;
}

const FIELD_LABELS: Partial<Record<string, string>> = {
  name: "nom",
  "config.url": "URL",
  "config.headers": "en-têtes",
  "config.body": "corps",
  "config.timeoutMs": "délai",
  "config.left": "valeur testée",
  "config.right": "valeur attendue",
  "config.source": "source",
  "config.pick": "champs à conserver",
  "config.extract": "champ à extraire",
  "config.filter.field": "champ filtré",
  "config.filter.value": "valeur du filtre",
};

// Contrôle avant envoi : un champ manquant est signalé sans appeler l'API
export function incompleteNodes(nodes: FlowNode[]): ApiError[] {
  return nodes.flatMap((node) => {
    const fields = Object.keys(validateNode(node)).map((path) => FIELD_LABELS[path] ?? path);
    if (fields.length === 0) return [];
    return [
      {
        code: "INCOMPLETE_NODE",
        message: `« ${node.data.name || node.id} » est incomplet : ${fields.join(", ")}`,
        nodeId: node.id,
      },
    ];
  });
}

function settle(outcome: RunOutcome) {
  return {
    running: false,
    outcome,
    resultsByNode:
      outcome.kind === "executed"
        ? Object.fromEntries(outcome.result.nodeResults.map((result) => [result.nodeId, result]))
        : {},
  };
}

export function createRunStore(runApi: (graph: WorkflowGraph) => Promise<RunOutcome> = postRun) {
  return create<RunState>()((set, get) => ({
    running: false,
    outcome: null,
    resultsByNode: {},

    reset: () => set({ outcome: null, resultsByNode: {} }),

    run: async (nodes, edges) => {
      if (get().running) return;

      const errors = incompleteNodes(nodes);
      if (errors.length > 0) {
        set(settle({ kind: "rejected", errors }));
        return;
      }

      // On efface le résultat précédent pour ne pas le confondre avec le nouveau
      set({ running: true, outcome: null, resultsByNode: {} });
      try {
        set(settle(await runApi(toGraph(nodes, edges))));
      } catch {
        set(settle({ kind: "unavailable", message: "Erreur inattendue pendant l'exécution." }));
      }
    },
  }));
}

export const useRunStore = createRunStore();
