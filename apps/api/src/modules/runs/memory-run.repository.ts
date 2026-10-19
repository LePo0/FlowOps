import { randomUUID } from "node:crypto";
import { MAX_RUNS_PER_WORKFLOW } from "@flowops/shared";
import type { WorkflowRepository } from "../workflows/workflow.repository.js";
import type { RunRepository, StoredRun } from "./run.repository.js";

// Implémentation en mémoire pour les tests de routes ; la propriété passe par les workflows
export function createMemoryRunRepository(workflows: WorkflowRepository): RunRepository {
  const runs: StoredRun[] = [];

  const newestFirst = (a: StoredRun, b: StoredRun) => b.startedAt.getTime() - a.startedAt.getTime();
  const owns = async (userId: string, workflowId: string) =>
    (await workflows.find(userId, workflowId)) !== null;

  return {
    record: async (userId, workflowId, run) => {
      if (!(await owns(userId, workflowId))) return null;
      const stored: StoredRun = { ...structuredClone(run), id: randomUUID(), workflowId };
      runs.push(stored);
      const kept = runs.filter((r) => r.workflowId === workflowId).sort(newestFirst);
      for (const old of kept.slice(MAX_RUNS_PER_WORKFLOW)) runs.splice(runs.indexOf(old), 1);
      return structuredClone(stored);
    },

    list: async (userId, workflowId) => {
      if (!(await owns(userId, workflowId))) return null;
      return runs
        .filter((run) => run.workflowId === workflowId)
        .sort(newestFirst)
        .map(({ id, status, startedAt, durationMs }) => ({
          id,
          workflowId,
          status,
          startedAt,
          durationMs,
        }));
    },

    find: async (userId, runId) => {
      const run = runs.find((candidate) => candidate.id === runId);
      return run && (await owns(userId, run.workflowId)) ? structuredClone(run) : null;
    },
  };
}
