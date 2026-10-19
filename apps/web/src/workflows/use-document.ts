import type { WorkflowGraph } from "@flowops/shared";
import { toGraph } from "../editor/graph.ts";
import { useEditorStore } from "../editor/store.ts";
import { useRunStore } from "../run/run-store.ts";
import { createWorkflowsApi } from "./api.ts";
import { createDocumentStore, documentSnapshot } from "./document-store.ts";

const LAST_OPENED_KEY = "flowops:last-workflow-id";

// Point de départ de « Nouveau » : un déclencheur seul
export const blankWorkflow: WorkflowGraph = {
  nodes: [
    { id: "trigger", type: "trigger", name: "Déclencheur", position: { x: 0, y: 0 }, config: {} },
  ],
  edges: [],
};

export const workflowsApi = createWorkflowsApi();

// localStorage peut être indisponible (navigation privée, stockage bloqué) : sans effet alors
const lastOpened = {
  get: () => {
    try {
      return localStorage.getItem(LAST_OPENED_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id === null) localStorage.removeItem(LAST_OPENED_KEY);
      else localStorage.setItem(LAST_OPENED_KEY, id);
    } catch {
      // Le dernier workflow ne sera simplement pas rouvert au rechargement
    }
  },
};

export const useDocumentStore = createDocumentStore({
  api: workflowsApi,
  getGraph: () => useEditorStore.getState().getGraph(),
  getNodes: () => useEditorStore.getState().nodes,
  loadGraph: (graph) => useEditorStore.getState().loadGraph(graph),
  onDocumentChanged: () => useRunStore.getState().reset(),
  lastOpened,
});

// Vrai s'il reste des modifications non enregistrées (graphe ou nom)
export function useIsDirty(): boolean {
  const name = useDocumentStore((state) => state.name);
  const savedSnapshot = useDocumentStore((state) => state.savedSnapshot);
  const current = useEditorStore((state) =>
    documentSnapshot(name, toGraph(state.nodes, state.edges)),
  );
  return current !== savedSnapshot;
}
