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
    output?: unknown;
    error?: string;
    durationMs: number;
}

export type ExecutionResult =
    | { status: "INVALID"; errors: ValidationError[] }
    | { status: "SUCCESS" | "FAILED"; nodeResults: NodeResult[]; durationMs: number };

export interface ExecutionDeps {
    fetch: typeof fetch;
}

export interface HandlerContext {
    outputs: Map<string, unknown>;
    fetch: typeof fetch;
}

export interface HandlerResult {
    output: unknown;
    branch?: "true" | "false";
}
