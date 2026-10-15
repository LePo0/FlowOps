import { Router } from "express";
import { executeWorkflow, type ExecutionDeps } from "../../engine/index.js";
import { RunRequestSchema } from "./run.schemas.js";

export function createRunRouter(deps: ExecutionDeps): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = RunRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        errors: parsed.error.issues.map((issue) => ({
          code: "INVALID_BODY",
          message: `${issue.path.map(String).join(".") || "corps"} : ${issue.message}`,
        })),
      });
      return;
    }

    const result = await executeWorkflow(parsed.data.graph, { fetch: deps.fetch });
    if (result.status === "INVALID") {
      res.status(400).json({ errors: result.errors });
      return;
    }

    // Un nœud en échec n'est pas une erreur HTTP : le détail est dans nodeResults
    const { status, nodeResults, durationMs } = result;
    res.status(200).json({ status, nodeResults, durationMs });
  });

  return router;
}
