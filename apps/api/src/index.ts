import { lookup } from "node:dns/promises";
import { createApp } from "./app.js";
import { createFirebaseTokenVerifier } from "./auth/firebase-token-verifier.js";
import { createPrismaUserDirectory } from "./auth/prisma-user-directory.js";
import { env } from "./config/env.js";
import { describeDatabaseError, loadServerConfig } from "./config/server-config.js";
import { createPrismaClient } from "./db/client.js";
import { createPrismaDemoSessionCleaner, scheduleDemoSessionCleanup } from "./demo/cleanup.js";
import { DEMO_EXAMPLES } from "./demo/examples.js";
import { createGuardedFetch } from "./engine/network/guarded-fetch.js";
import { pinnedTransport } from "./engine/network/transport.js";
import { createPrismaRunRepository } from "./modules/runs/prisma-run.repository.js";
import { createPrismaWorkflowRepository } from "./modules/workflows/prisma-workflow.repository.js";

// Variable obligatoire absente ou politique réseau mal écrite : arrêt immédiat
const loaded = loadServerConfig(env);
if (!loaded.ok) {
  console.error(loaded.error);
  process.exit(1);
}
const { databaseUrl, firebaseProjectId, networkPolicy } = loaded.config;

// fetch du nœud HTTP : politique réseau vérifiée à chaque connexion, redirections comprises
const guardedFetch = createGuardedFetch({
  policy: networkPolicy,
  resolve: async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address),
  transport: pinnedTransport,
});

const prisma = createPrismaClient(databaseUrl);

try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  console.error(describeDatabaseError(error, databaseUrl));
  process.exit(1);
}

const workflows = createPrismaWorkflowRepository(prisma);
const app = createApp({
  fetch: guardedFetch,
  auth: {
    verifyToken: createFirebaseTokenVerifier(firebaseProjectId),
    users: createPrismaUserDirectory(prisma, { demoExamples: DEMO_EXAMPLES }),
    demoSessionsEnabled: env.DEMO_SESSIONS_ENABLED,
  },
  workflows,
  runs: createPrismaRunRepository(prisma),
});

scheduleDemoSessionCleanup(createPrismaDemoSessionCleaner(prisma));

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
