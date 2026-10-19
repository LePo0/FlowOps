import { ApiErrorResponseSchema } from "@flowops/shared";
import type { z } from "zod";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

// Appel JSON de l'API : la réponse est validée avec le contrat partagé, les erreurs sont
// ramenées à un message lisible (codes de l'API, API arrêtée, réponse inattendue)
export async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T> | null,
  fetchImpl: typeof fetch,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    return { ok: false, message: "Impossible de joindre le serveur." };
  }

  if (response.status === 204 || schema === null) {
    return response.ok
      ? { ok: true, data: undefined as T }
      : { ok: false, message: `Erreur de l'API (HTTP ${response.status}).` };
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const parsed = schema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, message: "Réponse inattendue de l'API." };
  }

  const errors = ApiErrorResponseSchema.safeParse(body);
  if (errors.success) {
    return { ok: false, message: errors.data.errors.map((error) => error.message).join(" ; ") };
  }
  if (response.status >= 502 && response.status <= 504) {
    return {
      ok: false,
      message: "Impossible de joindre l'API. Est-elle démarrée (npm run dev:api) ?",
    };
  }
  return { ok: false, message: `Erreur de l'API (HTTP ${response.status}).` };
}
