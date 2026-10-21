import { Router, type Request, type RequestHandler } from "express";
import { currentPlan, currentUserId } from "../../auth/authenticate.js";
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
import { fitStoredSize } from "../../usage/stored-size.js";
import { RunRequestSchema } from "../run/run.schemas.js";
import type { WorkflowRepository } from "../workflows/workflow.repository.js";
import type { RunRepository, StoredRun, StoredRunSummary } from "./run.repository.js";

export interface RunsRouterDeps {
  runs: RunRepository;
  workflows: WorkflowRepository;
  fetch: typeof fetch;
  // Limites d'exécution (usage/run-limits.ts), appliquées avant la lecture du graphe
  limitRuns: RequestHandler;
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

  // Exécute le graphe envoyé (celui affiché dans l'éditeur, enregistré ou non) et l'historise
  router.post("/workflows/:id/runs", deps.limitRuns, async (req, res) => {
    const workflowId = idParam(req, "id");
    const userId = currentUserId(res);
    const plan = currentPlan(res);
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
    const result = await executeWorkflow(parsed.data.graph, {
      fetch: deps.fetch,
      maxDurationMs: plan.maxDurationMs,
      maxResponseBytes: plan.maxResponseBytes,
    });
    if (result.status === "INVALID") {
      const body: ApiErrorResponse = { errors: result.errors };
      res.status(400).json(body);
      return;
    }

    const stored = await deps.runs.record(
      userId,
      workflowId,
      {
        status: result.status,
        startedAt,
        durationMs: result.durationMs,
        // Déjà validé par le moteur : cette lecture ne fait que typer le graphe
        graph: WorkflowGraphSchema.parse(parsed.data.graph),
        nodeResults: fitStoredSize(result.nodeResults, plan.maxStoredRunBytes),
      },
      plan.keptRunsPerWorkflow,
    );
    if (!stored) {
      // Workflow supprimé pendant l'exécution
      res.status(404).json(WORKFLOW_NOT_FOUND);
      return;
    }
    // La réponse montre les résultats complets ; seul l'historique peut être allégé (Q7)
    const body: RunDetail = { ...toDetail(stored), nodeResults: result.nodeResults };
    res.status(201).location(`${req.baseUrl}/runs/${stored.id}`).json(body);
  });

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
