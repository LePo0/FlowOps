import {
  ApiErrorResponseSchema,
  WorkflowDetailSchema,
  WorkflowListSchema,
  type SaveWorkflowRequest,
  type WorkflowDetail,
  type WorkflowSummary,
} from "@flowops/shared";
import type { z } from "zod";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

// Appel JSON de l'API : la réponse est validée avec le contrat partagé, les erreurs sont
// ramenées à un message lisible (codes de l'API, API arrêtée, réponse inattendue)
async function request<T>(
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

export interface WorkflowsApi {
  list(): Promise<ApiResult<WorkflowSummary[]>>;
  get(id: string): Promise<ApiResult<WorkflowDetail>>;
  create(input: SaveWorkflowRequest): Promise<ApiResult<WorkflowDetail>>;
  update(id: string, input: SaveWorkflowRequest): Promise<ApiResult<WorkflowDetail>>;
  remove(id: string): Promise<ApiResult<void>>;
}

export function createWorkflowsApi(fetchImpl: typeof fetch = fetch): WorkflowsApi {
  const base = "/api/workflows";
  const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
  const json = (method: string, input: SaveWorkflowRequest): RequestInit => ({
    method,
    body: JSON.stringify(input),
  });

  return {
    list: async () => {
      const result = await request(base, {}, WorkflowListSchema, fetchImpl);
      return result.ok ? { ok: true, data: result.data.workflows } : result;
    },
    get: (id) => request(path(id), {}, WorkflowDetailSchema, fetchImpl),
    create: (input) => request(base, json("POST", input), WorkflowDetailSchema, fetchImpl),
    update: (id, input) => request(path(id), json("PUT", input), WorkflowDetailSchema, fetchImpl),
    remove: (id) => request<void>(path(id), { method: "DELETE" }, null, fetchImpl),
  };
}
