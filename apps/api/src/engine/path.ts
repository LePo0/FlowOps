/**
 * Lit un chemin ("ability.name", "results.0.url") dans une valeur.
 * Propriétés propres uniquement : jamais __proto__, constructor, etc.
 * Un indice de liste se lit comme un champ ("0"). Undefined si le chemin n'existe pas.
 */
export function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Écrit une valeur à un chemin dans un objet, en créant les objets intermédiaires.
 * defineProperty plutôt qu'une affectation : une clé "__proto__" reste une simple propriété.
 */
export function writePath(target: Record<string, unknown>, path: string[], value: unknown): void {
  let current = target;
  path.forEach((key, index) => {
    if (index === path.length - 1) {
      Object.defineProperty(current, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      return;
    }
    const existing = Object.hasOwn(current, key) ? current[key] : undefined;
    const next =
      existing !== null && typeof existing === "object"
        ? (existing as Record<string, unknown>)
        : {};
    if (next !== existing) {
      Object.defineProperty(current, key, {
        value: next,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    current = next;
  });
}
