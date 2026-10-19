import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { authenticate } from "./auth/authenticate.js";
import type { AuthDeps } from "./auth/identity.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRunRouter } from "./modules/run/run.router.js";
import type { RunRepository } from "./modules/runs/run.repository.js";
import { createRunsRouter } from "./modules/runs/runs.router.js";
import type { WorkflowRepository } from "./modules/workflows/workflow.repository.js";
import { createWorkflowsRouter } from "./modules/workflows/workflows.router.js";

export interface AppDeps {
  fetch: typeof fetch;
  nodeEnv?: typeof env.NODE_ENV;
  // Toutes les routes /api exigent un utilisateur authentifié
  auth: AuthDeps;
  // Absent : routes /api/workflows non montées (tests de l'exécution, sans base de données)
  workflows?: WorkflowRepository;
  // Historique des exécutions ; nécessite aussi `workflows` (propriété des workflows)
  runs?: RunRepository;
}

export function createApp(deps: AppDeps): Express {
  const nodeEnv = deps.nodeEnv ?? env.NODE_ENV;
  const app = express();

  app.use(helmet());
  // Seul l'éditeur peut appeler l'API depuis un navigateur
  app.use(cors({ origin: env.CORS_ORIGIN }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Avant la lecture du corps : une requête anonyme est refusée sans que son JSON soit analysé
  app.use("/api", authenticate(deps.auth));
  app.use(express.json({ limit: "1mb" }));

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
        workflows: deps.workflows,
        fetch: deps.fetch,
        // Même règle que /api/run ci-dessus
        allowExecution: nodeEnv !== "production",
      }),
    );
  }

  if (deps.workflows) {
    app.use("/api/workflows", createWorkflowsRouter({ repository: deps.workflows }));
  }

  app.use(errorHandler);

  return app;
}
