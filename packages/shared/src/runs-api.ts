import { z } from "zod";
import { NodeResultSchema, RunResultSchema } from "./run.js";
import { WorkflowGraphSchema } from "./workflow.js";

// Contrat de l'historique des exécutions d'un workflow enregistré

// Nombre d'exécutions gardées par workflow : les plus anciennes sont supprimées au-delà
export const MAX_RUNS_PER_WORKFLOW = 50;

// Élément de GET /api/workflows/:id/runs : sans graphe ni résultats, pour garder la liste légère
export const RunSummarySchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  status: RunResultSchema.shape.status,
  startedAt: z.iso.datetime(),
  durationMs: z.number(),
});

export const RunListSchema = z.object({
  runs: z.array(RunSummarySchema),
});

// GET /api/runs/:runId, et réponse de POST /api/workflows/:id/runs.
// Contient aussi tous les champs de RunResult : le front peut la lire comme une exécution simple.
export const RunDetailSchema = RunSummarySchema.extend({
  // Copie du graphe exécuté, qui peut différer de la version enregistrée du workflow
  graph: WorkflowGraphSchema,
  nodeResults: z.array(NodeResultSchema),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;
export type RunList = z.infer<typeof RunListSchema>;
export type RunDetail = z.infer<typeof RunDetailSchema>;
