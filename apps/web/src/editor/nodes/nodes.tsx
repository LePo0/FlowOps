import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import type { NodeType } from "@flowops/shared";
import type { FlowNodeOf } from "../graph.ts";
import { useRunStore } from "../../run/run-store.ts";
import { OPERATOR_SYMBOLS, STATUS_LABELS, TYPE_LABELS } from "../labels.ts";

function NodeCard({
  id,
  type,
  name,
  children,
}: {
  id: string;
  type: NodeType;
  name: string;
  children?: ReactNode;
}) {
  const result = useRunStore((state) => state.resultsByNode[id]);
  const flagged = useRunStore(
    (state) =>
      state.outcome?.kind === "rejected" &&
      state.outcome.errors.some((error) => error.nodeId === id),
  );
  const classes = [
    "flow-node",
    `flow-node--${type}`,
    result && `flow-node--run-${result.status}`,
    flagged && "flow-node--flagged",
  ];

  return (
    <div className={classes.filter(Boolean).join(" ")}>
      {result && (
        <span className={`flow-node__status flow-node__status--${result.status}`}>
          {STATUS_LABELS[result.status]}
        </span>
      )}
      <div className="flow-node__header">
        <span className="flow-node__type">{TYPE_LABELS[type]}</span>
        <code className="flow-node__id">{id}</code>
      </div>
      <div className="flow-node__name">{name}</div>
      {children !== undefined && <div className="flow-node__detail">{children}</div>}
    </div>
  );
}

// Valeur affichée quand un champ obligatoire n'est pas encore renseigné
function Missing({ label }: { label: string }) {
  return <span className="flow-node__missing">{label}</span>;
}

// Le déclencheur n'a pas d'entrée : le moteur refuse toute arête vers lui
export function TriggerNode({ id, data }: NodeProps<FlowNodeOf<"trigger">>) {
  return (
    <>
      <NodeCard id={id} type="trigger" name={data.name} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function HttpNode({ id, data }: NodeProps<FlowNodeOf<"http">>) {
  const { method, url } = data.config;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeCard id={id} type="http" name={data.name}>
        <strong>{method}</strong> {url || <Missing label="URL à renseigner" />}
      </NodeCard>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

// Deux sorties : leurs ids ("true" / "false") deviennent la branche de l'arête
export function ConditionNode({ id, data }: NodeProps<FlowNodeOf<"condition">>) {
  const { left, operator, right } = data.config;
  // Guillemets pour un texte : le moteur compare en strict, "200" n'est pas 200
  const shownRight = typeof right === "string" ? `"${right}"` : right;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeCard id={id} type="condition" name={data.name}>
        {left || <Missing label="valeur à renseigner" />} {OPERATOR_SYMBOLS[operator]}
        {operator !== "exists" && shownRight !== undefined && <> {String(shownRight)}</>}
      </NodeCard>
      <Handle id="true" type="source" position={Position.Right} className="flow-handle--true">
        <span className="flow-handle__label">vrai</span>
      </Handle>
      <Handle id="false" type="source" position={Position.Right} className="flow-handle--false">
        <span className="flow-handle__label">faux</span>
      </Handle>
    </>
  );
}

export function TransformNode({ id, data }: NodeProps<FlowNodeOf<"transform">>) {
  const { source, filter, pick, extract } = data.config;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeCard id={id} type="transform" name={data.name}>
        {source || <Missing label="source à renseigner" />}
        {filter !== undefined && (
          <>
            <br />
            si {filter.field || "…"} {OPERATOR_SYMBOLS[filter.operator]}
            {filter.operator !== "exists" && filter.value !== undefined && (
              <> {typeof filter.value === "string" ? `"${filter.value}"` : String(filter.value)}</>
            )}
          </>
        )}
        {pick !== undefined && pick.length > 0 && <> → {pick.join(", ")}</>}
        {extract !== undefined && extract !== "" && <> → [{extract}]</>}
      </NodeCard>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
