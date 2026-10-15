import { z } from "zod";

// Limites (le moteur et l'API s'y référeront)
export const MAX_NODES = 50;
export const MAX_EDGES = 100;

export const NodeTypeSchema = z.enum(["trigger", "http", "condition", "transform"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export const CONDITION_OPERATORS = ["eq", "neq", "gt", "lt", "contains", "exists"] as const;

export const PositionSchema = z.object({ x: z.number(), y: z.number() });

// Champs communs à tous les nœuds
const nodeBase = {
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "Identifiant invalide (lettres, chiffres, _ et - uniquement)"),
  name: z.string().min(1).max(100),
  position: PositionSchema,
};

export const TriggerNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("trigger"),
  config: z.object({}),
});

export const HttpNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("http"),
  config: z.object({
    method: z.enum(HTTP_METHODS),
    url: z.string().min(1).max(2048),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().max(100_000).optional(),
    timeoutMs: z.number().int().min(100).max(30_000).optional(),
  }),
});

export const ConditionNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("condition"),
  config: z.object({
    left: z.string().min(1), // référence, ex. "http1.status"
    operator: z.enum(CONDITION_OPERATORS),
    right: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }),
});

export const TransformNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("transform"),
  config: z.object({
    source: z.string().min(1), // référence, ex. "http1.body.products"
    pick: z.array(z.string().min(1)).optional(), // champs à conserver
  }),
});

// Union discriminée sur "type" : TypeScript sait quelle config correspond à quel nœud
export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  TriggerNodeSchema,
  HttpNodeSchema,
  ConditionNodeSchema,
  TransformNodeSchema,
]);

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  branch: z.enum(["true", "false"]).optional(), // sortie d'un nœud Condition
});

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema).min(1).max(MAX_NODES),
  edges: z.array(EdgeSchema).max(MAX_EDGES),
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type HttpNode = z.infer<typeof HttpNodeSchema>;
export type ConditionNode = z.infer<typeof ConditionNodeSchema>;
export type TransformNode = z.infer<typeof TransformNodeSchema>;
export type WorkflowEdge = z.infer<typeof EdgeSchema>;
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
