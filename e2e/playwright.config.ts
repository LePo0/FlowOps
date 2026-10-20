import { defineConfig, devices } from "@playwright/test";
import {
  API_PORT,
  API_URL,
  DATABASE_URL,
  EMULATOR_HOST,
  EMULATOR_URL,
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  ROOT,
  TARGET_HOST,
  TARGET_PORT,
  TARGET_URL,
  WEB_PORT,
  WEB_URL,
} from "./support/environment.ts";

const CI = Boolean(process.env.CI);

/**
 * Tests de bout en bout : un vrai navigateur pilote l'éditeur, qui parle à la vraie API et à
 * l'émulateur Firebase Auth. Quatre serveurs sont lancés (ou réutilisés en local) :
 * émulateur, service cible du nœud HTTP, API (base flowops_e2e), éditeur (Vite).
 */
export default defineConfig({
  testDir: "tests",
  // Une seule API et une seule base pour tous les tests : pas d'exécution en parallèle
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: WEB_URL,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Comptes en mémoire : repart de zéro à chaque lancement. Nécessite Java 21 ou plus.
      command: `npx firebase emulators:start --only auth --project ${FIREBASE_PROJECT_ID}`,
      url: EMULATOR_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: "node support/target-server.mjs",
      url: `${TARGET_URL}/health`,
      reuseExistingServer: !CI,
      env: { TARGET_HOST, TARGET_PORT: String(TARGET_PORT) },
    },
    {
      command: "node support/start-api.mjs",
      url: `${API_URL}/health`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        CORS_ORIGIN: WEB_URL,
        DATABASE_URL,
        FIREBASE_PROJECT_ID,
        FIREBASE_AUTH_EMULATOR_HOST: EMULATOR_HOST,
        // Seul le service cible est ouvert, en plus des adresses publiques
        HTTP_ALLOWED_TARGETS: `${TARGET_HOST}/32`,
        HTTP_DENIED_TARGETS: "",
      },
    },
    {
      // Variables d'environnement prioritaires sur apps/web/.env.local : le vrai projet n'est pas utilisé
      command: `npm run dev -w web -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: ROOT,
      url: WEB_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        API_URL,
        VITE_FIREBASE_API_KEY: FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
        VITE_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
        VITE_FIREBASE_APP_ID: "1:000000000000:web:e2e",
        VITE_FIREBASE_AUTH_EMULATOR_HOST: EMULATOR_HOST,
      },
    },
  ],
});
