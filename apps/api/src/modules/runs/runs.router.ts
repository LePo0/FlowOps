import { Router, type Request } from "express";
import { currentUserId } from "../../auth/authenticate.js";
import {
  WorkflowGraphSchema,
  type ApiErrorResponse,
  type RunDetail,
  type RunList,
  type RunSummary,
} from "@flowops/shared";
import { z } from "zod";
import { executeWorkflow } from "../../engine/index.js";
import { invalidBody, notFound } from "../../http/errors.js";
import { RunRequestSchema } from "../run/run.schemas.js";
import type { WorkflowRepository } from "../workflows/workflow.repository.js";
import type { RunRepository, StoredRun, StoredRunSummary } from "./run.repository.js";

export interface RunsRouterDeps {
  runs: RunRepository;
  workflows: WorkflowRepository;
  fetch: typeof fetch;
  // Faux en production : le nœud HTTP n'est pas encore protégé contre le SSRF (voir app.ts).
  // La consultation de l'historique reste possible.
  allowExecution: boolean;
}

const IdSchema = z.uuid();
const WORKFLOW_NOT_FOUND = notFound("Workflow introuvable");
const RUN_NOT_FOUND = notFound("Exécution introuvable");

const toSummary = (run: StoredRunSummary): RunSummary => ({
  id: run.id,
  workflowId: run.workflowId,
  status: run.status,
  startedAt: run.startedAt.toISOString(),
  durationMs: run.durationMs,
});

const toDetail = (run: StoredRun): RunDetail => ({
  ...toSummary(run),
  graph: run.graph,
  nodeResults: run.nodeResults,
});

// Monté sur /api : /api/workflows/:id/runs et /api/runs/:runId
export function createRunsRouter(deps: RunsRouterDeps): Router {
  const router = Router();
  const idParam = (req: Request, name: string) => {
    const parsed = IdSchema.safeParse(req.params[name]);
    return parsed.success ? parsed.data : null;
  };

  if (deps.allowExecution) {
    // Exécute le graphe envoyé (celui affiché dans l'éditeur, enregistré ou non) et l'historise
    router.post("/workflows/:id/runs", async (req, res) => {
      const workflowId = idParam(req, "id");
      const userId = currentUserId(res);
      // Vérifié avant d'exécuter : on n'appelle aucune URL pour le workflow d'un autre
      if (!workflowId || !(await deps.workflows.find(userId, workflowId))) {
        res.status(404).json(WORKFLOW_NOT_FOUND);
        return;
      }
      const parsed = RunRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json(invalidBody(parsed.error));
        return;
      }

      const startedAt = new Date();
      const result = await executeWorkflow(parsed.data.graph, { fetch: deps.fetch });
      if (result.status === "INVALID") {
        const body: ApiErrorResponse = { errors: result.errors };
        res.status(400).json(body);
        return;
      }

      const stored = await deps.runs.record(userId, workflowId, {
        status: result.status,
        startedAt,
        durationMs: result.durationMs,
        // Déjà validé par le moteur : cette lecture ne fait que typer le graphe
        graph: WorkflowGraphSchema.parse(parsed.data.graph),
        nodeResults: result.nodeResults,
      });
      if (!stored) {
        // Workflow supprimé pendant l'exécution
        res.status(404).json(WORKFLOW_NOT_FOUND);
        return;
      }
      res.status(201).location(`${req.baseUrl}/runs/${stored.id}`).json(toDetail(stored));
    });
  }

  router.get("/workflows/:id/runs", async (req, res) => {
    const workflowId = idParam(req, "id");
    const runs = workflowId && (await deps.runs.list(currentUserId(res), workflowId));
    if (!runs) {
      res.status(404).json(WORKFLOW_NOT_FOUND);
      return;
    }
    const body: RunList = { runs: runs.map(toSummary) };
    res.json(body);
  });

  router.get("/runs/:runId", async (req, res) => {
    const runId = idParam(req, "runId");
    const run = runId && (await deps.runs.find(currentUserId(res), runId));
    if (!run) {
      res.status(404).json(RUN_NOT_FOUND);
      return;
    }
    res.json(toDetail(run));
  });

  return router;
}
