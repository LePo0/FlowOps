import { useState } from "react";
import type { FlowNodeData } from "../graph.ts";
import { Comparison } from "./comparison.tsx";
import { DraftInput, Field } from "./fields.tsx";
import { formatPick, parsePick, type FieldErrors } from "./form-values.ts";

type TransformData = Extract<FlowNodeData, { type: "transform" }>;
type TransformFilter = NonNullable<TransformData["config"]["filter"]>;
type ResultMode = "all" | "pick" | "extract";

const RESULT_MODE_LABELS: Record<ResultMode, string> = {
  all: "Éléments entiers",
  pick: "Certains champs de chaque élément",
  extract: "Un seul champ : liste de valeurs",
};

export function TransformForm({
  data,
  errors,
  onChange,
}: {
  data: TransformData;
  errors: FieldErrors;
  onChange: (data: TransformData) => void;
}) {
  const { config } = data;
  const setConfig = (patch: Partial<typeof config>) =>
    onChange({ ...data, config: { ...config, ...patch } });
  // État local : « Certains champs » reste choisi même tant que la liste est vide
  const [mode, setMode] = useState<ResultMode>(
    config.extract !== undefined ? "extract" : config.pick !== undefined ? "pick" : "all",
  );

  return (
    <>
      <Field
        label="Source"
        hint="Référence vers la donnée à transformer, ex. http1.body.results"
        error={errors["config.source"]}
      >
        {(id) => (
          <input
            id={id}
            className="field__input field__input--mono"
            value={config.source}
            placeholder="http1.body.results"
            aria-invalid={errors["config.source"] !== undefined}
            onChange={(event) => setConfig({ source: event.target.value })}
          />
        )}
      </Field>

      <fieldset className="field-group">
        <legend className="field-group__legend">
          <label>
            <input
              type="checkbox"
              checked={config.filter !== undefined}
              onChange={(event) =>
                setConfig({
                  filter: event.target.checked ? { field: "", operator: "eq" } : undefined,
                })
              }
            />{" "}
            Filtrer les éléments de la liste
          </label>
        </legend>
        {config.filter !== undefined && (
          <FilterFields
            filter={config.filter}
            errors={errors}
            onChange={(filter) => setConfig({ filter })}
          />
        )}
      </fieldset>

      <Field label="Résultat">
        {(id) => (
          <select
            id={id}
            className="field__input"
            value={mode}
            onChange={(event) => {
              const next = (["all", "pick", "extract"] as const).find(
                (candidate) => candidate === event.target.value,
              );
              if (!next) return;
              setMode(next);
              // Un seul mode à la fois : on retire la configuration de l'autre
              setConfig({
                pick: next === "pick" ? config.pick : undefined,
                extract: next === "extract" ? config.extract : undefined,
              });
            }}
          >
            {Object.entries(RESULT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>

      {mode === "pick" && (
        <Field
          label="Champs à conserver"
          hint="Séparés par des virgules. Chemins imbriqués acceptés : ability.name"
          error={errors["config.pick"]}
        >
          {(id) => (
            <DraftInput
              id={id}
              initialText={formatPick(config.pick)}
              placeholder="ability.name, slot"
              onTextChange={(text) => setConfig({ pick: parsePick(text) })}
            />
          )}
        </Field>
      )}

      {mode === "extract" && (
        <Field
          label="Champ à extraire"
          hint="Chemin dans chaque élément, ex. ability.name → liste de noms"
          error={errors["config.extract"]}
        >
          {(id) => (
            <input
              id={id}
              className="field__input field__input--mono"
              value={config.extract ?? ""}
              placeholder="ability.name"
              aria-invalid={errors["config.extract"] !== undefined}
              onChange={(event) => setConfig({ extract: event.target.value })}
            />
          )}
        </Field>
      )}
    </>
  );
}

function FilterFields({
  filter,
  errors,
  onChange,
}: {
  filter: TransformFilter;
  errors: FieldErrors;
  onChange: (filter: TransformFilter) => void;
}) {
  return (
    <>
      <Field
        label="Champ comparé"
        hint="Chemin dans chaque élément, ex. is_hidden ou ability.name"
        error={errors["config.filter.field"]}
      >
        {(id) => (
          <input
            id={id}
            className="field__input field__input--mono"
            value={filter.field}
            placeholder="is_hidden"
            aria-invalid={errors["config.filter.field"] !== undefined}
            onChange={(event) => onChange({ ...filter, field: event.target.value })}
          />
        )}
      </Field>
      <Comparison
        operator={filter.operator}
        value={filter.value}
        valueLabel="Valeur"
        errors={{
          operator: errors["config.filter.operator"],
          value: errors["config.filter.value"],
        }}
        onChange={(operator, value) => onChange({ ...filter, operator, value })}
      />
    </>
  );
}
