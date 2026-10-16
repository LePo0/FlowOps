import type { TransformNode } from "@flowops/shared";
import { compare } from "./compare.js";
import { NodeError } from "./node-error.js";
import { readPath, writePath } from "./path.js";

type TransformOptions = Omit<TransformNode["config"], "source">;

const toPath = (path: string) => path.split(".");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Applique à la valeur source, dans cet ordre :
 * 1. le filtre (listes uniquement) : ne garde que les éléments qui vérifient la comparaison ;
 * 2. le champ à extraire (une valeur par élément) OU les champs à conserver (objets réduits).
 * Un champ absent de tous les éléments est une erreur : c'est presque toujours une faute de frappe.
 */
export function applyTransform(
  value: unknown,
  { filter, pick, extract }: TransformOptions,
): { input?: unknown; output: unknown } {
  let current = value;

  if (filter !== undefined) {
    if (!Array.isArray(value)) {
      throw new NodeError("Le filtre nécessite une liste", { input: { source: typeof value } });
    }
    const field = toPath(filter.field);
    current = value.filter((item, index) => {
      try {
        return compare(readPath(item, field), filter.operator, filter.value);
      } catch (error) {
        throw new NodeError(`Filtre, élément ${index} : ${message(error)}`, {
          input: { items: value.length },
        });
      }
    });
  }

  // Taille de la liste avant et après filtre : utile pour comprendre un résultat vide
  const input = Array.isArray(value)
    ? { items: value.length, ...(filter !== undefined && { kept: (current as unknown[]).length }) }
    : undefined;

  if (extract !== undefined) {
    const path = toPath(extract);
    if (!Array.isArray(current)) {
      const single = readPath(current, path);
      if (single === undefined) throw new NodeError(`Champ introuvable : ${extract}`, { input });
      return { input, output: single };
    }
    const values = current.map((item) => readPath(item, path));
    if (current.length > 0 && values.every((extracted) => extracted === undefined)) {
      throw new NodeError(`Champ introuvable dans les éléments : ${extract}`, { input });
    }
    // null plutôt qu'undefined : la position reste visible une fois sérialisée en JSON
    return { input, output: values.map((extracted) => extracted ?? null) };
  }

  if (pick !== undefined) {
    const items: unknown[] = Array.isArray(current) ? current : [current];
    const invalid = items.findIndex((item) => !isPlainObject(item));
    if (invalid !== -1) {
      throw new NodeError(`Les champs à conserver nécessitent des objets (élément ${invalid})`, {
        input,
      });
    }
    const paths = pick.map(toPath);
    paths.forEach((path, index) => {
      if (items.length > 0 && items.every((item) => readPath(item, path) === undefined)) {
        throw new NodeError(`Champ introuvable : ${pick[index]}`, { input });
      }
    });
    const picked = items.map((item) => {
      const result: Record<string, unknown> = {};
      for (const path of paths) {
        const fieldValue = readPath(item, path);
        if (fieldValue !== undefined) writePath(result, path, fieldValue);
      }
      return result;
    });
    return { input, output: Array.isArray(current) ? picked : picked[0] };
  }

  return { input, output: current };
}
