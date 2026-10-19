import type { WorkflowGraph } from "@flowops/shared";
import { create } from "zustand";
import type { FlowNode } from "../editor/graph.ts";
import { incompleteNodes } from "../run/run-store.ts";
import type { WorkflowsApi } from "./api.ts";

export const UNTITLED = "Sans titre";

// Empreinte comparée pour savoir s'il reste des modifications non enregistrées
export const documentSnapshot = (name: string, graph: WorkflowGraph) =>
  JSON.stringify({ name: name.trim(), graph });

export interface DocumentDeps {
  api: WorkflowsApi;
  getGraph: () => WorkflowGraph;
  getNodes: () => FlowNode[];
  loadGraph: (graph: WorkflowGraph) => void;
  // Appelé quand un autre workflow est chargé (ex. effacer les résultats d'exécution)
  onDocumentChanged: () => void;
  // Dernier workflow ouvert, pour le rouvrir au rechargement de la page
  lastOpened: { get: () => string | null; set: (id: string | null) => void };
}

export interface DocumentState {
  id: string | null;
  name: string;
  savedSnapshot: string;
  busy: "saving" | "loading" | null;
  error: string | null;
  setName: (name: string) => void;
  save: () => Promise<boolean>;
  open: (id: string) => Promise<boolean>;
  newDocument: (graph: WorkflowGraph) => void;
  restoreLast: () => Promise<void>;
  // Le workflow a été supprimé côté serveur : s'il est ouvert, il redevient non enregistré
  forget: (id: string) => void;
}

export function createDocumentStore(deps: DocumentDeps) {
  return create<DocumentState>()((set, get) => {
    // Après chargement, l'empreinte est calculée sur le graphe tel que l'éditeur le restitue
    const loaded = (id: string | null, name: string) => {
      deps.onDocumentChanged();
      deps.lastOpened.set(id);
      set({
        id,
        name,
        savedSnapshot: documentSnapshot(name, deps.getGraph()),
        busy: null,
        error: null,
      });
    };

    return {
      id: null,
      name: "",
      savedSnapshot: documentSnapshot("", deps.getGraph()),
      busy: null,
      error: null,

      setName: (name) => set({ name }),

      save: async () => {
        if (get().busy) return false;
        // Même contrôle qu'avant une exécution : l'API refuserait un nœud incomplet
        const incomplete = incompleteNodes(deps.getNodes());
        if (incomplete.length > 0) {
          set({
            error: `Impossible d'enregistrer : ${incomplete.map((e) => e.message).join(" ; ")}`,
          });
          return false;
        }

        const { id } = get();
        const name = get().name.trim() || UNTITLED;
        const graph = deps.getGraph();
        set({ busy: "saving", error: null });
        const result = id
          ? await deps.api.update(id, { name, graph })
          : await deps.api.create({ name, graph });
        if (!result.ok) {
          set({ busy: null, error: `Enregistrement impossible : ${result.message}` });
          return false;
        }
        deps.lastOpened.set(result.data.id);
        // Empreinte du graphe envoyé : une modification faite pendant l'envoi reste signalée
        set({
          id: result.data.id,
          name: result.data.name,
          savedSnapshot: documentSnapshot(result.data.name, graph),
          busy: null,
        });
        return true;
      },

      open: async (id) => {
        if (get().busy) return false;
        set({ busy: "loading", error: null });
        const result = await deps.api.get(id);
        if (!result.ok) {
          set({ busy: null, error: `Ouverture impossible : ${result.message}` });
          return false;
        }
        deps.loadGraph(result.data.graph);
        loaded(result.data.id, result.data.name);
        return true;
      },

      newDocument: (graph) => {
        deps.loadGraph(graph);
        loaded(null, "");
      },

      restoreLast: async () => {
        const id = deps.lastOpened.get();
        if (id === null) return;
        // Introuvable (supprimé entre-temps) : on oublie l'identifiant, sans bloquer l'éditeur
        if (!(await get().open(id))) deps.lastOpened.set(null);
      },

      forget: (id) => {
        if (get().id !== id) return;
        deps.lastOpened.set(null);
        // Empreinte vide : le contenu affiché n'est plus enregistré nulle part
        set({ id: null, savedSnapshot: "" });
      },
    };
  });
}
