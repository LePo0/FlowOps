import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// Seule TEST_DATABASE_URL est transmise aux tests, jamais DATABASE_URL : un test ne doit
// pas pouvoir toucher la base de développement. Absente : les tests d'intégration sont ignorés.
const local = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL ?? "";
// test.env ne vaut que pour les tests : la préparation globale (migrations) lit process.env
if (testDatabaseUrl) process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    env: { TEST_DATABASE_URL: testDatabaseUrl },
    globalSetup: ["./src/test-support/migrate-test-database.ts"],
    // Les tests d'intégration partagent la même base : pas d'exécution en parallèle entre fichiers
    fileParallelism: false,
  },
});
