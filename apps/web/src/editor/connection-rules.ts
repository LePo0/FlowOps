import type { Connection } from "@xyflow/react";
import { topologicalSort } from "@flowops/shared";
import type { FlowEdge, FlowNode } from "./graph.ts";

type ConnectionLike = Pick<Connection, "source" | "target"> & {
  sourceHandle?: string | null;
};

// Mêmes règles que validateGraph côté moteur, appliquées pendant que l'utilisateur dessine.
// L'API reste l'autorité : elle revalide le graphe complet à l'exécution.
export function canConnect(
  connection: ConnectionLike,
  nodes: FlowNode[],
  edges: FlowEdge[],
): boolean {
  const { source, target } = connection;
  const sourceHandle = connection.sourceHandle ?? null;

  if (source === target) return false;

  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) return false;

  // Le déclencheur ne peut pas avoir d'entrée
  if (targetNode.type === "trigger") return false;

  // Une condition sort toujours par une branche, les autres nœuds jamais
  const isBranch = sourceHandle === "true" || sourceHandle === "false";
  if ((sourceNode.type === "condition") !== isBranch) return false;

  const duplicate = edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (edge.sourceHandle ?? null) === sourceHandle,
  );
  if (duplicate) return false;

  // L'arête ne doit pas créer de cycle
  return (
    topologicalSort(
      nodes.map((node) => node.id),
      [...edges, { source, target }],
    ) !== null
  );
}
