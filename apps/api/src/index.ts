import { createApp } from "./app.js";
import { createFirebaseTokenVerifier } from "./auth/firebase-token-verifier.js";
import { createPrismaUserDirectory } from "./auth/prisma-user-directory.js";
import { env } from "./config/env.js";
import { createPrismaClient } from "./db/client.js";
import { createPrismaRunRepository } from "./modules/runs/prisma-run.repository.js";
import { createPrismaWorkflowRepository } from "./modules/workflows/prisma-workflow.repository.js";

const missing = [
  !env.DATABASE_URL && "DATABASE_URL (voir docs/architecture.md, section Persistance)",
  !env.FIREBASE_PROJECT_ID &&
    "FIREBASE_PROJECT_ID (voir docs/architecture.md, section Authentification)",
].filter(Boolean);
if (!env.DATABASE_URL || !env.FIREBASE_PROJECT_ID) {
  console.error(`Variables manquantes dans apps/api/.env : ${missing.join(", ")}.`);
  process.exit(1);
}

const prisma = createPrismaClient(env.DATABASE_URL);

// Premier accès à la base : en cas d'échec, un message qui dit quoi faire plutôt qu'une trace Prisma
try {
  await prisma.$queryRaw`SELECT 1`;
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

const workflows = createPrismaWorkflowRepository(prisma);
const app = createApp({
  fetch,
  auth: {
    verifyToken: createFirebaseTokenVerifier(env.FIREBASE_PROJECT_ID),
    users: createPrismaUserDirectory(prisma),
  },
  workflows,
  runs: createPrismaRunRepository(prisma),
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
