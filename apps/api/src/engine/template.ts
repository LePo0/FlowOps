import { resolveReference } from "./resolve-reference.js";

// {{ référence }} : espaces tolérés autour de la référence, pas d'accolade à l'intérieur
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Remplace chaque {{idDuNoeud.chemin}} par la valeur correspondante dans les sorties.
 * Les valeurs ne sont pas encodées : {{http1.body.next}} peut fournir une URL complète.
 * Lance une erreur si la référence est inconnue ou vide.
 */
export function interpolate(template: string, outputs: Map<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_match, reference: string) => {
    const value = resolveReference(reference, outputs);
    if (value === undefined || value === null) {
      throw new Error(`La référence ${reference} est vide`);
    }
    if (typeof value === "string") return value;
    // Objets et listes en JSON : utile pour construire un corps de requête
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}
