import type { NodeResult } from "@flowops/shared";

export const NOT_KEPT = "Non conservé dans l'historique : limite de stockage de la session de démo";

const jsonBytes = (value: unknown) =>
  value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value), "utf8");

/**
 * Résultats à conserver dans l'historique, dans la limite de `maxBytes` (scénario Q7).
 * Les nœuds sont parcourus dans l'ordre d'exécution : dès que le budget est dépassé, l'entrée et
 * la sortie des nœuds suivants sont remplacées par un message. Statut, erreur et durée restent.
 */
export function fitStoredSize(nodeResults: NodeResult[], maxBytes: number | null): NodeResult[] {
  if (maxBytes === null) return nodeResults;
  let used = 0;
  return nodeResults.map((result) => {
    used += jsonBytes(result.input) + jsonBytes(result.output);
    if (used <= maxBytes) return result;
    const { input, output, ...kept } = result;
    return {
      ...kept,
      ...(input !== undefined && { input: NOT_KEPT }),
      ...(output !== undefined && { output: NOT_KEPT }),
    };
  });
}
