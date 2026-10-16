import { HTTP_METHODS } from "@flowops/shared";
import type { FlowNodeData } from "../graph.ts";
import { Comparison } from "./comparison.tsx";
import { DraftInput, Field } from "./fields.tsx";
import {
  formatHeaders,
  parseHeaders,
  parseOptionalNumber,
  type FieldErrors,
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

      <Field
        label="URL"
        hint="Valeur d'un nœud précédent : {{http1.body.results.0.url}}"
        error={errors["config.url"]}
      >
        {(id) => (
          <input
            id={id}
            className="field__input field__input--mono"
            // Texte et non "url" : une URL avec {{références}} n'est pas encore valide
            type="text"
            inputMode="url"
            spellCheck={false}
            value={config.url}
            placeholder="https://exemple.com/api"
            aria-invalid={errors["config.url"] !== undefined}
            onChange={(event) => setConfig({ url: event.target.value })}
          />
        )}
      </Field>

      <Field
        label="En-têtes"
        hint="Un par ligne : Nom: valeur. Les {{références}} sont acceptées."
        error={errors["config.headers"]}
      >
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
        hint={
          config.method === "GET"
            ? "Ignoré pour une requête GET"
            : "Les {{références}} sont acceptées. Un objet ou une liste est inséré en JSON."
        }
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

export function ConditionForm({ data, errors, onChange }: FormProps<"condition">) {
  const { config } = data;
  const setConfig = (patch: Partial<typeof config>) =>
    onChange({ ...data, config: { ...config, ...patch } });

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

      <Comparison
        operator={config.operator}
        value={config.right}
        valueLabel="Valeur attendue"
        errors={{ operator: errors["config.operator"], value: errors["config.right"] }}
        onChange={(operator, right) => setConfig({ operator, right })}
      />
    </>
  );
}
