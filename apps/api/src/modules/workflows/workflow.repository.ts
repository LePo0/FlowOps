import type { SaveWorkflowRequest, WorkflowGraph } from "@flowops/shared";

export interface StoredWorkflow {
  id: string;
  name: string;
  graph: WorkflowGraph;
  createdAt: Date;
  updatedAt: Date;
}

export type StoredWorkflowSummary = Omit<StoredWorkflow, "graph">;

/**
 * Accès aux workflows, toujours limité à un utilisateur : un workflow d'un autre utilisateur
 * se comporte exactement comme un workflow inexistant (null / false).
 */
export interface WorkflowRepository {
  list(userId: string): Promise<StoredWorkflowSummary[]>;
  find(userId: string, id: string): Promise<StoredWorkflow | null>;
  create(userId: string, input: SaveWorkflowRequest): Promise<StoredWorkflow>;
  update(userId: string, id: string, input: SaveWorkflowRequest): Promise<StoredWorkflow | null>;
  remove(userId: string, id: string): Promise<boolean>;
}
