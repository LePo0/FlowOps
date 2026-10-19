import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createPrismaClient } from "./db/client.js";
import { ensureDemoUser } from "./db/demo-user.js";
import { createPrismaRunRepository } from "./modules/runs/prisma-run.repository.js";
import { createPrismaWorkflowRepository } from "./modules/workflows/prisma-workflow.repository.js";

if (!env.DATABASE_URL) {
  console.error(
    "DATABASE_URL manquante dans apps/api/.env : voir docs/architecture.md, section Persistance.",
  );
  process.exit(1);
}

const prisma = createPrismaClient(env.DATABASE_URL);

// Premier accès à la base : en cas d'échec, un message qui dit quoi faire plutôt qu'une trace Prisma
let demoUserId: string;
try {
  demoUserId = await ensureDemoUser(prisma);
} catch (error) {
  const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
  const { hostname, port } = new URL(env.DATABASE_URL);
  console.error(
    code === "ECONNREFUSED"
      ? `Base de données injoignable sur ${hostname}:${port}. En local, démarrez-la avec : npm run db:start`
      : `Accès à la base de données impossible (${code ?? "erreur inconnue"}) : ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

const app = createApp({
  fetch,
  workflows: {
    repository: createPrismaWorkflowRepository(prisma),
    resolveUserId: () => demoUserId,
  },
  runs: createPrismaRunRepository(prisma),
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
