import { Router } from "express";
import type { ApiErrorResponse, RunResult } from "@flowops/shared";
import { executeWorkflow, type ExecutionDeps } from "../../engine/index.js";
import { RunRequestSchema } from "./run.schemas.js";

// Les réponses sont typées avec le contrat partagé, que le front valide à la réception
export function createRunRouter(deps: ExecutionDeps): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = RunRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const body: ApiErrorResponse = {
        errors: parsed.error.issues.map((issue) => ({
          code: "INVALID_BODY",
          message: `${issue.path.map(String).join(".") || "corps"} : ${issue.message}`,
        })),
      };
      res.status(400).json(body);
      return;
    }

    const result = await executeWorkflow(parsed.data.graph, { fetch: deps.fetch });
    if (result.status === "INVALID") {
      const body: ApiErrorResponse = { errors: result.errors };
      res.status(400).json(body);
      return;
    }

    // Un nœud en échec n'est pas une erreur HTTP : le détail est dans nodeResults
    const body: RunResult = {
      status: result.status,
      nodeResults: result.nodeResults,
      durationMs: result.durationMs,
    };
    res.status(200).json(body);
  });

  return router;
}
