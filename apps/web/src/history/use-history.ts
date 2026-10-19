import { authFetch } from "../auth/session.ts";
import { postRun } from "../run/api.ts";
import { createRunsApi } from "./api.ts";
import { createHistoryStore } from "./history-store.ts";

export const useHistoryStore = createHistoryStore({
  api: createRunsApi(authFetch),
  runGraph: (graph, workflowId) => postRun(graph, { workflowId, fetchImpl: authFetch }),
});
