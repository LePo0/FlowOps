import { RunDetailSchema, RunListSchema, type RunDetail, type RunSummary } from "@flowops/shared";
import { request, type ApiResult } from "../api/request.ts";

export interface RunsApi {
  // Exécutions d'un workflow enregistré, de la plus récente à la plus ancienne
  list(workflowId: string): Promise<ApiResult<RunSummary[]>>;
  // Exécution complète : copie du graphe exécuté et résultat de chaque nœud
  get(runId: string): Promise<ApiResult<RunDetail>>;
}

export function createRunsApi(fetchImpl: typeof fetch = fetch): RunsApi {
  return {
    list: async (workflowId) => {
      const path = `/api/workflows/${encodeURIComponent(workflowId)}/runs`;
      const result = await request(path, {}, RunListSchema, fetchImpl);
      return result.ok ? { ok: true, data: result.data.runs } : result;
    },
    get: (runId) =>
      request(`/api/runs/${encodeURIComponent(runId)}`, {}, RunDetailSchema, fetchImpl),
  };
}
