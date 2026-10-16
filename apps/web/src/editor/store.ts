import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { demoWorkflow, type NodeType, type WorkflowGraph } from "@flowops/shared";
import { create } from "zustand";
import { canConnect } from "./connection-rules.ts";
import { fromGraph, toGraph, type FlowEdge, type FlowNode, type FlowNodeData } from "./graph.ts";

export interface EditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: XYPosition) => string | null;
  updateNodeData: (id: string, data: FlowNodeData) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string) => void;
  loadGraph: (graph: WorkflowGraph) => void;
  getGraph: () => WorkflowGraph;
}

// Valeurs initiales d'un nouveau nœud : brouillon à compléter dans le panneau de configuration
const DEFAULT_DATA: Record<NodeType, FlowNodeData> = {
  trigger: { type: "trigger", name: "Déclencheur", config: {} },
  http: { type: "http", name: "Requête HTTP", config: { method: "GET", url: "" } },
  condition: { type: "condition", name: "Condition", config: { left: "", operator: "eq" } },
  transform: { type: "transform", name: "Transformation", config: { source: "" } },
};

// Premier identifiant libre de la forme "http-1", "http-2"… (compatible avec le regex des ids)
function nextNodeId(type: NodeType, nodes: FlowNode[]): string {
  const taken = new Set(nodes.map((node) => node.id));
  let index = 1;
  while (taken.has(`${type}-${index}`)) index++;
  return `${type}-${index}`;
}

function edgeId({ source, sourceHandle, target }: Connection): string {
  return sourceHandle ? `${source}.${sourceHandle}->${target}` : `${source}->${target}`;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...fromGraph(demoWorkflow),

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  // React Flow filtre déjà avec isValidConnection ; on revérifie pour que le store reste cohérent
  onConnect: (connection) => {
    const { nodes, edges } = get();
    if (!canConnect(connection, nodes, edges)) return;
    set({ edges: addEdge({ ...connection, id: edgeId(connection) }, edges) });
  },

  // Le nouveau nœud est sélectionné pour ouvrir son panneau ; un seul déclencheur autorisé
  addNode: (type, position) => {
    const { nodes } = get();
    if (type === "trigger" && nodes.some((node) => node.type === "trigger")) return null;

    const id = nextNodeId(type, nodes);
    const data = structuredClone(DEFAULT_DATA[type]);
    set({
      nodes: [
        ...nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
        { id, type, position, data, selected: true },
      ],
    });
    return id;
  },

  updateNodeData: (id, data) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, type: data.type, data } : node,
      ),
    }),

  removeNode: (id) =>
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
    }),

  // Sélectionne ce seul nœud (ex. depuis la liste des erreurs d'exécution)
  selectNode: (id) =>
    set({
      nodes: get().nodes.map((node) =>
        Boolean(node.selected) === (node.id === id) ? node : { ...node, selected: node.id === id },
      ),
    }),

  loadGraph: (graph) => set(fromGraph(graph)),

  getGraph: () => toGraph(get().nodes, get().edges),
}));
