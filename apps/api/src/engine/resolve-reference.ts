import { readPath } from "./path.js";

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
  return readPath(outputs.get(nodeId), path);
}
