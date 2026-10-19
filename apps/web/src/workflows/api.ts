import {
  WorkflowDetailSchema,
  WorkflowListSchema,
  type SaveWorkflowRequest,
  type WorkflowDetail,
  type WorkflowSummary,
} from "@flowops/shared";
import { request, type ApiResult } from "../api/request.ts";

export type { ApiResult };

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
