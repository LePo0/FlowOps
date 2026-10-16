import type { XYPosition } from "@xyflow/react";
import type { FlowNode } from "./graph.ts";

// Taille d'un nœud avant que React Flow ne l'ait mesuré (voir .flow-node dans editor.css)
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 80;
const GAP = 20;

function overlaps({ x, y }: XYPosition, node: FlowNode): boolean {
  const width = node.measured?.width ?? NODE_WIDTH;
  const height = node.measured?.height ?? NODE_HEIGHT;
  return (
    x < node.position.x + width + GAP &&
    x + NODE_WIDTH + GAP > node.position.x &&
    y < node.position.y + height + GAP &&
    y + NODE_HEIGHT + GAP > node.position.y
  );
}

// Descend la position jusqu'à une zone libre, pour ne pas recouvrir un nœud existant
export function freePosition(position: XYPosition, nodes: FlowNode[]): XYPosition {
  let { y } = position;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!nodes.some((node) => overlaps({ x: position.x, y }, node))) break;
    y += NODE_HEIGHT / 2;
  }
  return { x: position.x, y };
}
