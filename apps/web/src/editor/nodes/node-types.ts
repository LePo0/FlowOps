import type { NodeTypes } from "@xyflow/react";
import type { NodeType } from "@flowops/shared";
import { ConditionNode, HttpNode, TransformNode, TriggerNode } from "./nodes.tsx";

// Défini hors des composants : React Flow exige une référence stable
export const nodeTypes = {
  trigger: TriggerNode,
  http: HttpNode,
  condition: ConditionNode,
  transform: TransformNode,
} satisfies Record<NodeType, NodeTypes[string]>;
