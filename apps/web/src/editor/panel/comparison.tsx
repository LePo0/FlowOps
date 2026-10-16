import { CONDITION_OPERATORS } from "@flowops/shared";
import { useState } from "react";
import { OPERATOR_LABELS } from "../labels.ts";
import { DraftInput, Field } from "./fields.tsx";
import {
  convertRight,
  parseOptionalNumber,
  rightKind,
  type RightKind,
  type RightValue,
} from "./form-values.ts";

const RIGHT_KIND_LABELS: Record<RightKind, string> = {
  string: "Texte",
  number: "Nombre",
  boolean: "Booléen",
};

export type Operator = (typeof CONDITION_OPERATORS)[number];

// Opérateur, type et valeur comparée : partagé par la condition et le filtre de la transformation.
// Le moteur compare en strict (===) : le type de la valeur est donc explicite.
export function Comparison({
  operator,
  value,
  valueLabel,
  errors,
  onChange,
}: {
  operator: Operator;
  value: RightValue;
  valueLabel: string;
  errors: { operator?: string; value?: string };
  onChange: (operator: Operator, value: RightValue) => void;
}) {
  // État local, initialisé depuis la valeur : un nombre vidé pendant la saisie (undefined)
  // ne doit pas faire repasser le type à « Texte » sous le curseur
  const [kind, setKind] = useState<RightKind>(() => rightKind(value));

  return (
    <>
      <Field label="Opérateur" error={errors.operator}>
        {(id) => (
          <select
            id={id}
            className="field__input"
            value={operator}
            onChange={(event) => {
              const next = CONDITION_OPERATORS.find(
                (candidate) => candidate === event.target.value,
              );
              if (!next) return;
              // "existe" ne compare à rien : on retire la valeur
              onChange(next, next === "exists" ? undefined : value);
            }}
          >
            {CONDITION_OPERATORS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {OPERATOR_LABELS[candidate]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {operator !== "exists" && (
        <div className="field-row">
          <Field label="Type">
            {(id) => (
              <select
                id={id}
                className="field__input"
                value={kind}
                onChange={(event) => {
                  const next = (["string", "number", "boolean"] as const).find(
                    (candidate) => candidate === event.target.value,
                  );
                  if (!next) return;
                  setKind(next);
                  onChange(operator, convertRight(value, next));
                }}
              >
                {Object.entries(RIGHT_KIND_LABELS).map(([candidate, label]) => (
                  <option key={candidate} value={candidate}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label={valueLabel} error={errors.value}>
            {(id) =>
              kind === "boolean" ? (
                <select
                  id={id}
                  className="field__input"
                  value={String(value)}
                  onChange={(event) => onChange(operator, event.target.value === "true")}
                >
                  <option value="true">vrai</option>
                  <option value="false">faux</option>
                </select>
              ) : kind === "number" ? (
                <DraftInput
                  key="number"
                  id={id}
                  initialText={value?.toString() ?? ""}
                  placeholder="200"
                  onTextChange={(text) => onChange(operator, parseOptionalNumber(text))}
                />
              ) : (
                <input
                  id={id}
                  className="field__input"
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => onChange(operator, event.target.value)}
                />
              )
            }
          </Field>
        </div>
      )}
    </>
  );
}
