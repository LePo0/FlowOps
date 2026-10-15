import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRunRouter } from "./modules/run/run.router.js";

export interface AppDeps {
  fetch: typeof fetch;
  nodeEnv?: typeof env.NODE_ENV;
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

  app.use(errorHandler);

  return app;
}

export const app = createApp({ fetch });
