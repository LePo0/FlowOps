import { createNetworkPolicy, type NetworkPolicy } from "../engine/network/policy.js";
import type { Env } from "./env.js";

export interface ServerConfig {
  databaseUrl: string;
  firebaseProjectId: string;
  networkPolicy: NetworkPolicy;
}

export type ServerConfigResult = { ok: true; config: ServerConfig } | { ok: false; error: string };

/**
 * Configuration nécessaire au démarrage du serveur, ou le message qui explique pourquoi il
 * refuse de démarrer. Une liste réseau mal écrite ne doit pas ouvrir (ou fermer) le réseau en
 * silence : elle bloque le démarrage, comme une variable obligatoire absente.
 */
export function loadServerConfig(env: Env): ServerConfigResult {
  const { DATABASE_URL: databaseUrl, FIREBASE_PROJECT_ID: firebaseProjectId } = env;
  if (!databaseUrl || !firebaseProjectId) {
    const missing = [
      !databaseUrl && "DATABASE_URL (voir docs/architecture.md, section Persistance)",
      !firebaseProjectId &&
        "FIREBASE_PROJECT_ID (voir docs/architecture.md, section Authentification)",
    ].filter(Boolean);
    return {
      ok: false,
      error: `Variables manquantes dans apps/api/.env : ${missing.join(", ")}.`,
    };
  }

  try {
    const networkPolicy = createNetworkPolicy({
      allowed: env.HTTP_ALLOWED_TARGETS,
      denied: env.HTTP_DENIED_TARGETS,
    });
    return { ok: true, config: { databaseUrl, firebaseProjectId, networkPolicy } };
  } catch (error) {
    return {
      ok: false,
      error: `HTTP_ALLOWED_TARGETS ou HTTP_DENIED_TARGETS : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Premier accès à la base en échec : un message qui dit quoi faire plutôt qu'une trace Prisma
export function describeDatabaseError(error: unknown, databaseUrl: string): string {
  const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
  const { hostname, port } = new URL(databaseUrl);
  return code === "ECONNREFUSED"
    ? `Base de données injoignable sur ${hostname}:${port}. En local, démarrez-la avec : npm run db:start`
    : `Accès à la base de données impossible (${code ?? "erreur inconnue"}) : ${error instanceof Error ? error.message : String(error)}`;
}
