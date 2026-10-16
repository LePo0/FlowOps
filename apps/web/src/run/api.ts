import {
  ApiErrorResponseSchema,
  RunResultSchema,
  type ApiError,
  type RunResult,
  type WorkflowGraph,
} from "@flowops/shared";

export type RunOutcome =
  // L'exécution a eu lieu, qu'elle réussisse ou échoue sur un nœud
  | { kind: "executed"; result: RunResult }
  // Le workflow a été refusé avant exécution (par l'éditeur ou par l'API)
  | { kind: "rejected"; errors: ApiError[] }
  // L'API n'a pas pu répondre correctement
  | { kind: "unavailable"; message: string };

export async function postRun(
  graph: WorkflowGraph,
  fetchImpl: typeof fetch = fetch,
): Promise<RunOutcome> {
  let response: Response;
  try {
    response = await fetchImpl("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph }),
    });
  } catch {
    return { kind: "unavailable", message: "Impossible de joindre l'API." };
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (response.ok) {
    const result = RunResultSchema.safeParse(body);
    return result.success
      ? { kind: "executed", result: result.data }
      : { kind: "unavailable", message: "Réponse inattendue de l'API." };
  }

  const errors = ApiErrorResponseSchema.safeParse(body);
  if (errors.success) return { kind: "rejected", errors: errors.data.errors };

  if (response.status === 404) {
    return {
      kind: "unavailable",
      message: "La route /api/run est absente : elle est désactivée en production.",
    };
  }
  // Le proxy Vite répond 502 quand l'API n'est pas démarrée
  if (response.status >= 502 && response.status <= 504) {
    return {
      kind: "unavailable",
      message: "Impossible de joindre l'API. Est-elle démarrée (npm run dev:api) ?",
    };
  }
  return {
    kind: "unavailable",
    message: `L'API ne répond pas correctement (HTTP ${response.status}).`,
  };
}
