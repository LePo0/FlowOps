import { Panel, useReactFlow, useStore } from "@xyflow/react";
import type { NodeType } from "@flowops/shared";
import { TYPE_LABELS } from "./labels.ts";
import { freePosition, NODE_HEIGHT, NODE_WIDTH } from "./placement.ts";
import { useEditorStore } from "./store.ts";

const NODE_TYPES: NodeType[] = ["trigger", "http", "condition", "transform"];

// Barre d'ajout, affichée dans le canvas : les nouveaux nœuds apparaissent au centre de la vue
export function Toolbar() {
  const addNode = useEditorStore((state) => state.addNode);
  const hasTrigger = useEditorStore((state) => state.nodes.some((node) => node.type === "trigger"));
  const domNode = useStore((state) => state.domNode);
  const { screenToFlowPosition } = useReactFlow();

  const add = (type: NodeType) => {
    const rect = domNode?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    const position = { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 };
    addNode(type, freePosition(position, useEditorStore.getState().nodes));
  };

  return (
    <Panel position="top-left" className="toolbar" aria-label="Ajouter un nœud">
      {NODE_TYPES.map((type) => {
        const disabled = type === "trigger" && hasTrigger;
        return (
          <button
            key={type}
            type="button"
            className={`button toolbar__button toolbar__button--${type}`}
            disabled={disabled}
            title={disabled ? "Un workflow ne contient qu'un seul déclencheur" : undefined}
            onClick={() => add(type)}
          >
            + {TYPE_LABELS[type]}
          </button>
        );
      })}
    </Panel>
  );
}
