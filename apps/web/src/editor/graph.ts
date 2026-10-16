import type { Edge, Node } from "@xyflow/react";
import type { NodeType, WorkflowEdge, WorkflowGraph, WorkflowNode } from "@flowops/shared";

// Omit qui se distribue sur l'union : chaque type de nœud garde sa propre config
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// Données portées par un nœud React Flow : tout le nœud métier sauf id et position,
// que React Flow gère lui-même
export type FlowNodeData = DistributiveOmit<WorkflowNode, "id" | "position">;
export type FlowNode = Node<FlowNodeData, NodeType>;
export type FlowNodeOf<T extends NodeType> = Node<Extract<FlowNodeData, { type: T }>, T>;

// La branche d'une condition correspond à la poignée de sortie utilisée (sourceHandle)
export type FlowEdge = Edge;

const BRANCHES = ["true", "false"] as const;
type Branch = (typeof BRANCHES)[number];

function isBranch(value: string | null | undefined): value is Branch {
  return BRANCHES.some((branch) => branch === value);
}

export function fromGraph(graph: WorkflowGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: graph.nodes.map(({ id, position, ...data }) => ({
      id,
      type: data.type,
      position: { x: position.x, y: position.y },
      data,
    })),
    edges: graph.edges.map(({ id, source, target, branch }) => ({
      id,
      source,
      target,
      ...(branch !== undefined && { sourceHandle: branch }),
    })),
  };
}

// Ne garde que le contrat du workflow : les champs propres à React Flow
// (selected, measured, dragging, …) ne sortent jamais de l'éditeur
export function toGraph(nodes: FlowNode[], edges: FlowEdge[]): WorkflowGraph {
  return {
    nodes: nodes.map((node) => ({
      ...node.data,
      id: node.id,
      position: { x: node.position.x, y: node.position.y },
    })),
    edges: edges.map((edge): WorkflowEdge => {
      const { id, source, target, sourceHandle } = edge;
      return isBranch(sourceHandle)
        ? { id, source, target, branch: sourceHandle }
        : { id, source, target };
    }),
  };
}
