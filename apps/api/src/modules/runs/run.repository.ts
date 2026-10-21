import type { NodeResult, RunResult, WorkflowGraph } from "@flowops/shared";

export interface StoredRunSummary {
  id: string;
  workflowId: string;
  status: RunResult["status"];
  startedAt: Date;
  durationMs: number;
}

export interface StoredRun extends StoredRunSummary {
  graph: WorkflowGraph;
  // Dans l'ordre d'exécution
  nodeResults: NodeResult[];
}

export type NewRun = Omit<StoredRun, "id" | "workflowId">;

/**
 * Historique des exécutions, limité aux workflows de l'utilisateur : un workflow ou une
 * exécution d'un autre utilisateur se comporte comme s'il n'existait pas (null).
 */
export interface RunRepository {
  // Enregistre l'exécution puis ne garde que les `keep` plus récentes du workflow
  record(userId: string, workflowId: string, run: NewRun, keep: number): Promise<StoredRun | null>;
  list(userId: string, workflowId: string): Promise<StoredRunSummary[] | null>;
  find(userId: string, runId: string): Promise<StoredRun | null>;
}
