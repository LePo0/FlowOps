import { Router, type Request } from "express";
import { currentUserId } from "../../auth/authenticate.js";
import {
  SaveWorkflowRequestSchema,
  type WorkflowDetail,
  type WorkflowList,
  type WorkflowSummary,
} from "@flowops/shared";
import { z } from "zod";
import { invalidBody, notFound } from "../../http/errors.js";
import type {
  StoredWorkflow,
  StoredWorkflowSummary,
  WorkflowRepository,
} from "./workflow.repository.js";

export interface WorkflowsRouterDeps {
  repository: WorkflowRepository;
}

const IdSchema = z.uuid();
const NOT_FOUND = notFound("Workflow introuvable");

const toSummary = (workflow: StoredWorkflowSummary): WorkflowSummary => ({
  id: workflow.id,
  name: workflow.name,
  createdAt: workflow.createdAt.toISOString(),
  updatedAt: workflow.updatedAt.toISOString(),
});

const toDetail = (workflow: StoredWorkflow): WorkflowDetail => ({
  ...toSummary(workflow),
  graph: workflow.graph,
});

export function createWorkflowsRouter({ repository }: WorkflowsRouterDeps): Router {
  const router = Router();

  // Un identifiant mal formé ne peut désigner aucun workflow : 404, comme un id inconnu
  const workflowId = (req: Request) => {
    const parsed = IdSchema.safeParse(req.params["id"]);
    return parsed.success ? parsed.data : null;
  };

  router.get("/", async (req, res) => {
    const workflows = await repository.list(currentUserId(res));
    const body: WorkflowList = { workflows: workflows.map(toSummary) };
    res.json(body);
  });

  router.post("/", async (req, res) => {
    const parsed = SaveWorkflowRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidBody(parsed.error));
      return;
    }
    const created = await repository.create(currentUserId(res), parsed.data);
    res.status(201).location(`${req.baseUrl}/${created.id}`).json(toDetail(created));
  });

  router.get("/:id", async (req, res) => {
    const id = workflowId(req);
    const workflow = id && (await repository.find(currentUserId(res), id));
    if (!workflow) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.json(toDetail(workflow));
  });

  router.put("/:id", async (req, res) => {
    const id = workflowId(req);
    if (!id) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    const parsed = SaveWorkflowRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidBody(parsed.error));
      return;
    }
    const updated = await repository.update(currentUserId(res), id, parsed.data);
    if (!updated) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.json(toDetail(updated));
  });

  router.delete("/:id", async (req, res) => {
    const id = workflowId(req);
    if (!id || !(await repository.remove(currentUserId(res), id))) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    res.status(204).end();
  });

  return router;
}
