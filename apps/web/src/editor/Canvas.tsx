import { Background, Controls, ReactFlow, type IsValidConnection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";
import type { FlowEdge, FlowNode } from "./graph.ts";
import { nodeTypes } from "./nodes/node-types.ts";
import { useEditorStore } from "./store.ts";
import { Toolbar } from "./Toolbar.tsx";
import { canConnect } from "./connection-rules.ts";
import "./editor.css";

// Lit l'état au moment du test : pas besoin de recréer la fonction à chaque rendu
const isValidConnection: IsValidConnection<FlowEdge> = (connection) => {
  const { nodes, edges } = useEditorStore.getState();
  return canConnect(connection, nodes, edges);
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useEditorStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      onConnect: state.onConnect,
    })),
  );

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      deleteKeyCode={["Backspace", "Delete"]}
      colorMode="system"
      fitView
    >
      <Background />
      <Controls />
      <Toolbar />
    </ReactFlow>
  );
}
