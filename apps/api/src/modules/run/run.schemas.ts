import { z } from "zod";

// Enveloppe seulement : le graphe lui-même est validé par le moteur (executeWorkflow)
export const RunRequestSchema = z.object({
  graph: z.looseObject({}),
});

export type RunRequest = z.infer<typeof RunRequestSchema>;
