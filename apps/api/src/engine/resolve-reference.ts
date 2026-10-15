/**
 * Résout une référence "idDuNoeud.chemin.vers.valeur" dans les sorties déjà produites.
 * Lance une erreur si le nœud n'existe pas ou n'a pas été exécuté.
 * Retourne undefined si le chemin n'existe pas dans la sortie.
 */
export function resolveReference(reference: string, outputs: Map<string, unknown>): unknown {
  const [nodeId, ...path] = reference.split(".");
  if (nodeId === undefined || !outputs.has(nodeId)) {
    throw new Error(`Référence inconnue ou nœud non exécuté : ${reference}`);
  }

  let current: unknown = outputs.get(nodeId);
  for (const key of path) {
    // Propriétés propres uniquement : jamais __proto__, constructor, etc.
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
