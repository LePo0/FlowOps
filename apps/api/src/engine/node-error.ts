/**
 * Échec d'un nœud accompagné de ce qu'il a réellement utilisé (ex. la requête envoyée),
 * pour que l'utilisateur voie pourquoi : URL finale après {{références}}, valeur testée, …
 */
export class NodeError extends Error {
  readonly input: unknown;

  constructor(message: string, options: { input: unknown; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "NodeError";
    this.input = options.input;
  }
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = "code" in error && typeof error.code === "string" ? ` [${error.code}]` : "";
  return `${error.name}: ${error.message}${code}`;
}

/**
 * Chaîne des causes techniques, de la plus proche à la plus profonde.
 * Undefined quand il n'y a rien de plus que le message déjà affiché.
 * Pas de stack trace : seulement nom, message et code de chaque erreur.
 */
export function technicalDetail(error: unknown): string | undefined {
  const lines: string[] = [];
  let current = error instanceof Error ? error.cause : undefined;
  for (let depth = 0; current !== undefined && depth < 5; depth++) {
    lines.push(describe(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return lines.length > 0 ? lines.join("\n← causé par ") : undefined;
}
