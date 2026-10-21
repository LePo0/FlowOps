import type { WorkflowGraph } from "@flowops/shared";

export type ValidationErrorCode =
  | "INVALID_SHAPE"
  | "DUPLICATE_NODE_ID"
  | "UNKNOWN_NODE"
  | "TRIGGER_COUNT"
  | "TRIGGER_HAS_INCOMING_EDGE"
  | "INVALID_BRANCH"
  | "CYCLE";

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export type ValidationResult =
  { ok: true; graph: WorkflowGraph } | { ok: false; errors: ValidationError[] };

export type NodeStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface NodeResult {
  nodeId: string;
  status: NodeStatus;
  // Ce que le nœud a réellement utilisé (requête envoyée, valeur testée), pour le débogage
  input?: unknown;
  output?: unknown;
  error?: string;
  // Causes techniques de l'erreur (nom, message, code), sans stack trace
  errorDetail?: string;
  durationMs: number;
}

export type ExecutionResult =
  | { status: "INVALID"; errors: ValidationError[] }
  | { status: "SUCCESS" | "FAILED"; nodeResults: NodeResult[]; durationMs: number };

export interface ExecutionDeps {
  fetch: typeof fetch;
  // Durée maximale de toute l'exécution (60 s par défaut)
  maxDurationMs?: number;
  // Taille maximale d'une réponse HTTP, en octets décompressés (1 Mo par défaut)
  maxResponseBytes?: number;
}

export interface HandlerContext {
  outputs: Map<string, unknown>;
  fetch: typeof fetch;
  // Échéance globale de l'exécution : annule la requête en cours quand elle est atteinte
  deadline: AbortSignal;
  maxDurationMs: number;
  maxResponseBytes: number;
}

export interface HandlerResult {
  input?: unknown;
  output: unknown;
  branch?: "true" | "false";
}
