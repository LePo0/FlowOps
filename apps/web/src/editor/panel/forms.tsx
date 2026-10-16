import { CONDITION_OPERATORS, HTTP_METHODS } from "@flowops/shared";
import type { FlowNodeData } from "../graph.ts";
import { OPERATOR_LABELS } from "../labels.ts";
import { DraftInput, Field } from "./fields.tsx";
import {
  convertRight,
  formatHeaders,
  formatPick,
  parseHeaders,
  parseOptionalNumber,
  parsePick,
  rightKind,
  type FieldErrors,
  type RightKind,
} from "./form-values.ts";

interface FormProps<T extends FlowNodeData["type"]> {
  data: Extract<FlowNodeData, { type: T }>;
  errors: FieldErrors;
  onChange: (data: Extract<FlowNodeData, { type: T }>) => void;
}

export function HttpForm({ data, errors, onChange }: FormProps<"http">) {
  const { config } = data;
  const setConfig = (patch: Partial<typeof config>) =>
    onChange({ ...data, config: { ...config, ...patch } });

  return (
    <>
      <Field label="Méthode" error={errors["config.method"]}>
        {(id) => (
          <select
            id={id}
            className="field__input"
            value={config.method}
            onChange={(event) => {
              const method = HTTP_METHODS.find((value) => value === event.target.value);
              if (method) setConfig({ method });
            }}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        )}
      </Field>

      <Field label="URL" error={errors["config.url"]}>
        {(id) => (
          <input
            id={id}
            className="field__input"
            type="url"
            value={config.url}
            placeholder="https://exemple.com/api"
            aria-invalid={errors["config.url"] !== undefined}
            onChange={(event) => setConfig({ url: event.target.value })}
          />
        )}
      </Field>

      <Field label="En-têtes" hint="Un par ligne : Nom: valeur" error={errors["config.headers"]}>
        {(id) => (
          <DraftInput
            id={id}
            multiline
            initialText={formatHeaders(config.headers)}
            placeholder="Accept: application/json"
            onTextChange={(text) => setConfig({ headers: parseHeaders(text) })}
          />
        )}
      </Field>

      <Field
        label="Corps"
        hint={config.method === "GET" ? "Ignoré pour une requête GET" : undefined}
        error={errors["config.body"]}
      >
        {(id) => (
          <textarea
            id={id}
            className="field__input"
            rows={4}
            value={config.body ?? ""}
            disabled={config.method === "GET"}
            onChange={(event) => setConfig({ body: event.target.value || undefined })}
          />
        )}
      </Field>

      <Field
        label="Délai maximal (ms)"
        hint="Entre 100 et 30 000. Par défaut : 10 000"
        error={errors["config.timeoutMs"]}
      >
        {(id) => (
          <DraftInput
            id={id}
            initialText={config.timeoutMs?.toString() ?? ""}
            placeholder="10000"
            invalid={errors["config.timeoutMs"] !== undefined}
            onTextChange={(text) => setConfig({ timeoutMs: parseOptionalNumber(text) })}
          />
        )}
      </Field>
    </>
  );
}

const RIGHT_KIND_LABELS: Record<RightKind, string> = {
  string: "Texte",
  number: "Nombre",
  boolean: "Booléen",
};

export function ConditionForm({ data, errors, onChange }: FormProps<"condition">) {
  const { config } = data;
  const setConfig = (patch: Partial<typeof config>) =>
    onChange({ ...data, config: { ...config, ...patch } });
  const kind = rightKind(config.right);

  return (
    <>
      <Field
        label="Valeur testée"
        hint="Référence vers la sortie d'un nœud, ex. http1.status"
        error={errors["config.left"]}
      >
        {(id) => (
          <input
            id={id}
            className="field__input field__input--mono"
            value={config.left}
            placeholder="http1.status"
            aria-invalid={errors["config.left"] !== undefined}
            onChange={(event) => setConfig({ left: event.target.value })}
          />
        )}
      </Field>

      <Field label="Opérateur" error={errors["config.operator"]}>
        {(id) => (
          <select
            id={id}
            className="field__input"
            value={config.operator}
            onChange={(event) => {
              const operator = CONDITION_OPERATORS.find((value) => value === event.target.value);
              if (!operator) return;
              // "existe" ne compare à rien : on retire la valeur
              setConfig(operator === "exists" ? { operator, right: undefined } : { operator });
            }}
          >
            {CONDITION_OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {OPERATOR_LABELS[operator]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {config.operator !== "exists" && (
        <div className="field-row">
          <Field label="Type">
            {(id) => (
              <select
                id={id}
                className="field__input"
                value={kind}
                onChange={(event) => {
                  const next = (["string", "number", "boolean"] as const).find(
                    (value) => value === event.target.value,
                  );
                  if (next) setConfig({ right: convertRight(config.right, next) });
                }}
              >
                {Object.entries(RIGHT_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Valeur attendue" error={errors["config.right"]}>
            {(id) =>
              kind === "boolean" ? (
                <select
                  id={id}
                  className="field__input"
                  value={String(config.right)}
                  onChange={(event) => setConfig({ right: event.target.value === "true" })}
                >
                  <option value="true">vrai</option>
                  <option value="false">faux</option>
                </select>
              ) : kind === "number" ? (
                <DraftInput
                  key="number"
                  id={id}
                  initialText={config.right?.toString() ?? ""}
                  placeholder="200"
                  onTextChange={(text) => setConfig({ right: parseOptionalNumber(text) })}
                />
              ) : (
                <input
                  id={id}
                  className="field__input"
                  value={typeof config.right === "string" ? config.right : ""}
                  onChange={(event) => setConfig({ right: event.target.value })}
                />
              )
            }
          </Field>
        </div>
      )}
    </>
  );
}

export function TransformForm({ data, errors, onChange }: FormProps<"transform">) {
  const { config } = data;
  const setConfig = (patch: Partial<typeof config>) =>
    onChange({ ...data, config: { ...config, ...patch } });

  return (
    <>
      <Field
        label="Source"
        hint="Référence vers la donnée à transformer, ex. http1.body.products"
        error={errors["config.source"]}
      >
        {(id) => (
          <input
            id={id}
            className="field__input field__input--mono"
            value={config.source}
            placeholder="http1.body.products"
            aria-invalid={errors["config.source"] !== undefined}
            onChange={(event) => setConfig({ source: event.target.value })}
          />
        )}
      </Field>

      <Field
        label="Champs à conserver"
        hint="Séparés par des virgules. Vide : tout garder"
        error={errors["config.pick"]}
      >
        {(id) => (
          <DraftInput
            id={id}
            initialText={formatPick(config.pick)}
            placeholder="title, price"
            onTextChange={(text) => setConfig({ pick: parsePick(text) })}
          />
        )}
      </Field>
    </>
  );
}
