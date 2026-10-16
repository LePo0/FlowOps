import { WorkflowNodeSchema, type ConditionNode } from "@flowops/shared";
import type { FlowNode } from "../graph.ts";

// --- En-têtes HTTP : une ligne "Nom: valeur" par en-tête ---

export function formatHeaders(headers: Record<string, string> | undefined): string {
  return Object.entries(headers ?? {})
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

// Les lignes sans ":" ou sans nom sont ignorées ; aucun en-tête donne undefined
export function parseHeaders(text: string): Record<string, string> | undefined {
  const entries = text
    .split("\n")
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return null;
      const name = line.slice(0, separator).trim();
      return name ? ([name, line.slice(separator + 1).trim()] as const) : null;
    })
    .filter((entry) => entry !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

// --- Champs à conserver (transform.pick) : liste séparée par des virgules ---

export function formatPick(pick: string[] | undefined): string {
  return (pick ?? []).join(", ");
}

export function parsePick(text: string): string[] | undefined {
  const fields = text
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  return fields.length > 0 ? fields : undefined;
}

// --- Nombre optionnel (timeout) : vide ou invalide donne undefined ---

export function parseOptionalNumber(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

// --- Valeur comparée par une condition ---
// Le moteur compare en strict (===) : 200 et "200" sont différents, d'où un type explicite

export type RightValue = ConditionNode["config"]["right"];
export type RightKind = "string" | "number" | "boolean";

export function rightKind(value: RightValue): RightKind {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export function convertRight(value: RightValue, kind: RightKind): RightValue {
  const text = value === undefined ? "" : String(value);
  switch (kind) {
    case "string":
      return text;
    case "number":
      return parseOptionalNumber(text);
    case "boolean":
      return text === "false" ? false : true;
  }
}

// --- Validation d'un nœud avec le schéma partagé ---

export type FieldErrors = Partial<Record<string, string>>;

// Erreurs indexées par chemin ("name", "config.url", …) pour les afficher sous chaque champ
export function validateNode(node: FlowNode): FieldErrors {
  const result = WorkflowNodeSchema.safeParse({
    ...node.data,
    id: node.id,
    position: node.position,
  });
  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join(".");
    const required = issue.code === "too_small" && issue.origin === "string" && issue.minimum === 1;
    errors[path] ??= required ? "Champ obligatoire" : issue.message;
  }
  return errors;
}
