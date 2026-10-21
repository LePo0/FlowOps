import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// Environnement des tests de bout en bout : ports, projet de l'émulateur, base, service cible.
// Lu par playwright.config.ts (lancement des serveurs) et par les tests eux-mêmes.

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// Projet demo-* : réservé à l'émulateur, aucun vrai projet Firebase ne peut porter ce nom.
// L'API n'accepte les jetons non signés de l'émulateur que pour un tel projet.
export const FIREBASE_PROJECT_ID = "demo-flowops";
export const FIREBASE_API_KEY = "demo-api-key";
export const EMULATOR_HOST = "127.0.0.1:9099";
export const EMULATOR_URL = `http://${EMULATOR_HOST}`;

// Ports distincts de ceux du développement (3000, 5173) : les deux peuvent tourner ensemble
export const API_PORT = 3100;
export const WEB_PORT = 5174;
export const TARGET_PORT = 3200;
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * Adresse du service cible appelé par le nœud HTTP. La boucle locale est toujours refusée par
 * la politique réseau : le service écoute sur une adresse privée de la machine, que l'API ouvre
 * avec HTTP_ALLOWED_TARGETS (mode entreprise). Le lien local (169.254.x) est lui aussi interdit.
 */
function privateAddress(): string {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry !== undefined)
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address)
    .filter((address) => !address.startsWith("169.254."));
  const address = process.env.E2E_TARGET_HOST ?? candidates[0];
  if (!address) {
    throw new Error(
      "Aucune adresse réseau non locale pour le service cible : définissez E2E_TARGET_HOST",
    );
  }
  return address;
}

export const TARGET_HOST = privateAddress();
export const TARGET_URL = `http://${TARGET_HOST}:${TARGET_PORT}`;

/**
 * Base dédiée (flowops_e2e) sur le serveur de la base de test : les tests d'intégration de
 * l'API vident la leur, les deux suites ne se gênent pas. Créée et migrée par start-api.mjs.
 */
function databaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const envFile = `${ROOT}apps/api/.env`;
  const local = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  const testUrl = process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "Base des tests de bout en bout introuvable : définissez E2E_DATABASE_URL ou TEST_DATABASE_URL (apps/api/.env)",
    );
  }
  const url = new URL(testUrl);
  url.pathname = "/flowops_e2e";
  return url.href;
}

export const DATABASE_URL = databaseUrl();
