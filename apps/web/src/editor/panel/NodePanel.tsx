import { NodeRunResult } from "../../run/NodeRunResult.tsx";
import type { FlowNode, FlowNodeData } from "../graph.ts";
import { referenceExample, TYPE_LABELS } from "../labels.ts";
import { useEditorStore } from "../store.ts";
import { Field } from "./fields.tsx";
import { validateNode } from "./form-values.ts";
import { ConditionForm, HttpForm } from "./forms.tsx";
import { TransformForm } from "./transform-form.tsx";
import "./panel.css";

// Panneau latéral : configure le nœud sélectionné (un seul à la fois)
export function NodePanel() {
  const node = useEditorStore((state) => {
    const selected = state.nodes.filter((candidate) => candidate.selected);
    return selected.length === 1 ? selected[0] : undefined;
  });

  return (
    <aside className="panel" aria-label="Configuration du nœud">
      {node ? (
        // La clé remet à zéro les brouillons de saisie quand on change de nœud
        <NodeEditor key={node.id} node={node} />
      ) : (
        <p className="panel__empty">
          Sélectionnez un nœud pour le configurer, ou ajoutez-en un depuis la barre d'outils.
        </p>
      )}
    </aside>
  );
}

function NodeEditor({ node }: { node: FlowNode }) {
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const removeNode = useEditorStore((state) => state.removeNode);
  const update = (data: FlowNodeData) => updateNodeData(node.id, data);
  const errors = validateNode(node);
  const { data } = node;
  const reference = referenceExample(node.id, data.type);

  return (
    <div className="panel__content">
      <header className="panel__header">
        <span className={`panel__type panel__type--${data.type}`}>{TYPE_LABELS[data.type]}</span>
        <h2 className="panel__title">{data.name || "Sans nom"}</h2>
        <p className="panel__id">
          Identifiant : <code>{node.id}</code>
          {reference !== null && (
            <>
              <br />
              <span className="panel__id-hint">
                Sortie utilisable dans les références : <code>{reference}</code>
              </span>
            </>
          )}
        </p>
      </header>

      <NodeRunResult nodeId={node.id} />

      <Field label="Nom" error={errors["name"]}>
        {(id) => (
          <input
            id={id}
            className="field__input"
            value={data.name}
            aria-invalid={errors["name"] !== undefined}
            onChange={(event) => update({ ...data, name: event.target.value })}
          />
        )}
      </Field>

      {data.type === "trigger" && (
        <p className="panel__note">Point de départ du workflow. Aucun réglage nécessaire.</p>
      )}
      {data.type === "http" && <HttpForm data={data} errors={errors} onChange={update} />}
      {data.type === "condition" && <ConditionForm data={data} errors={errors} onChange={update} />}
      {data.type === "transform" && <TransformForm data={data} errors={errors} onChange={update} />}

      <button type="button" className="button button--danger" onClick={() => removeNode(node.id)}>
        Supprimer le nœud
      </button>
    </div>
  );
}
