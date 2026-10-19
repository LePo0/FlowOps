import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// Avant les tests : applique les migrations à la base de test, si elle est configurée
export default function migrateTestDatabase(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    // En local, sans base de test, les tests d'intégration sont ignorés. En CI, ce serait
    // une erreur de configuration : on échoue plutôt que de les sauter en silence.
    if (process.env.CI) throw new Error("TEST_DATABASE_URL manquante en CI");
    return;
  }

  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  // DATABASE_URL forcée : prisma.config.ts ne l'écrase pas avec celle de .env
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Migration de la base de test impossible :\n${result.stdout}\n${result.stderr}`,
    );
  }
}
