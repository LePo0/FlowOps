import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { authenticate } from "./auth/authenticate.js";
import type { AuthDeps } from "./auth/identity.js";
import { env } from "./config/env.js";
import { logForwardedFor } from "./http/forwarded-for-diagnostic.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRunRouter } from "./modules/run/run.router.js";
import type { RunRepository } from "./modules/runs/run.repository.js";
import { createRunsRouter } from "./modules/runs/runs.router.js";
import type { WorkflowRepository } from "./modules/workflows/workflow.repository.js";
import { createWorkflowsRouter } from "./modules/workflows/workflows.router.js";
import { createRunLimits } from "./usage/run-limits.js";

export interface AppDeps {
  // fetch du nœud HTTP : en production, le fetch gardé par la politique réseau (index.ts)
  fetch: typeof fetch;
  // Toutes les routes /api exigent un utilisateur authentifié
  auth: AuthDeps;
  // Absent : routes /api/workflows non montées (tests de l'exécution, sans base de données)
  workflows?: WorkflowRepository;
  // Historique des exécutions ; nécessite aussi `workflows` (propriété des workflows)
  runs?: RunRepository;
  // Nombre de proxys devant l'API (1 derrière Cloud Run) : req.ip, base des limites par adresse
  trustProxyHops?: number;
  // Horloge des limites d'exécution, remplacée dans les tests
  now?: () => number;
  // Diagnostic des en-têtes d'adresse (LOG_FORWARDED_FOR)
  logForwardedFor?: boolean;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.set("trust proxy", deps.trustProxyHops ?? env.TRUST_PROXY_HOPS);
  const limitRuns = createRunLimits(deps.now);

  app.use(helmet());
  // Seul l'éditeur peut appeler l'API depuis un navigateur
  app.use(cors({ origin: env.CORS_ORIGIN }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (deps.logForwardedFor ?? env.LOG_FORWARDED_FOR) app.use("/api", logForwardedFor);

  // Avant la lecture du corps : une requête anonyme est refusée sans que son JSON soit analysé
  app.use("/api", authenticate(deps.auth));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/run", createRunRouter({ fetch: deps.fetch, limitRuns }));

  if (deps.workflows && deps.runs) {
    app.use(
      "/api",
      createRunsRouter({
        runs: deps.runs,
        workflows: deps.workflows,
        fetch: deps.fetch,
        limitRuns,
      }),
    );
  }

  if (deps.workflows) {
    app.use("/api/workflows", createWorkflowsRouter({ repository: deps.workflows }));
  }

  app.use(errorHandler);

  return app;
}
