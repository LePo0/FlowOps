import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRunRouter } from "./modules/run/run.router.js";
import type { RunRepository } from "./modules/runs/run.repository.js";
import { createRunsRouter } from "./modules/runs/runs.router.js";
import {
  createWorkflowsRouter,
  type WorkflowsRouterDeps,
} from "./modules/workflows/workflows.router.js";

export interface AppDeps {
  fetch: typeof fetch;
  nodeEnv?: typeof env.NODE_ENV;
  // Absent : routes /api/workflows non montées (tests de l'exécution, sans base de données)
  workflows?: WorkflowsRouterDeps;
  // Historique des exécutions ; nécessite aussi `workflows` (propriété des workflows)
  runs?: RunRepository;
}

export function createApp(deps: AppDeps): Express {
  const nodeEnv = deps.nodeEnv ?? env.NODE_ENV;
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Le nœud HTTP n'est pas encore protégé contre le SSRF : exposée en ligne, cette route
  // permettrait d'appeler des adresses locales ou privées depuis le serveur. On ne la monte
  // donc qu'en local, jusqu'à l'étape « Sécurité du nœud HTTP » de docs/roadmap.md.
  if (nodeEnv !== "production") {
    app.use("/api/run", createRunRouter({ fetch: deps.fetch }));
  }

  if (deps.workflows && deps.runs) {
    app.use(
      "/api",
      createRunsRouter({
        runs: deps.runs,
        workflows: deps.workflows.repository,
        fetch: deps.fetch,
        resolveUserId: deps.workflows.resolveUserId,
        // Même règle que /api/run ci-dessus
        allowExecution: nodeEnv !== "production",
      }),
    );
  }

  if (deps.workflows) {
    app.use("/api/workflows", createWorkflowsRouter(deps.workflows));
  }

  app.use(errorHandler);

  return app;
}

export const app = createApp({ fetch });
