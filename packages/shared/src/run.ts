import { z } from "zod";

// Contrat de POST /api/run : le front valide la réponse avec ces schémas

export const NodeStatusSchema = z.enum(["SUCCESS", "FAILED", "SKIPPED"]);

export const NodeResultSchema = z.object({
  nodeId: z.string(),
  status: NodeStatusSchema,
  // Ce que le nœud a réellement utilisé : requête envoyée (après {{références}}), valeur testée
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  // Causes techniques de l'erreur, pour le débogage
  errorDetail: z.string().optional(),
  durationMs: z.number(),
});

// 200 : l'exécution a eu lieu (un nœud en échec n'est pas une erreur HTTP)
export const RunResultSchema = z.object({
  status: z.enum(["SUCCESS", "FAILED"]),
  nodeResults: z.array(NodeResultSchema),
  durationMs: z.number(),
});

// 4xx / 5xx : codes stables (CYCLE, INVALID_BODY, INVALID_JSON, …)
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  errors: z.array(ApiErrorSchema),
});

export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type NodeResult = z.infer<typeof NodeResultSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
