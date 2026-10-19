import { z } from "zod";
import { WorkflowGraphSchema } from "./workflow.js";

// Contrat de /api/workflows : l'API valide les requêtes, le front valide les réponses

export const WorkflowNameSchema = z.string().trim().min(1).max(100);

// POST /api/workflows et PUT /api/workflows/:id
export const SaveWorkflowRequestSchema = z.object({
  name: WorkflowNameSchema,
  graph: WorkflowGraphSchema,
});

// Élément de GET /api/workflows : sans le graphe, pour garder la liste légère
export const WorkflowSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const WorkflowListSchema = z.object({
  workflows: z.array(WorkflowSummarySchema),
});

// GET /api/workflows/:id, et réponse de la création et de la mise à jour
export const WorkflowDetailSchema = WorkflowSummarySchema.extend({
  graph: WorkflowGraphSchema,
});

export type SaveWorkflowRequest = z.infer<typeof SaveWorkflowRequestSchema>;
export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;
export type WorkflowList = z.infer<typeof WorkflowListSchema>;
export type WorkflowDetail = z.infer<typeof WorkflowDetailSchema>;
