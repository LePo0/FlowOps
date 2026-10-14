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