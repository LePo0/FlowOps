import { MAX_RUNS_PER_WORKFLOW } from "@flowops/shared";
import { DEFAULT_MAX_DURATION_MS, MAX_RESPONSE_BYTES } from "../engine/limits.js";

// Session de démo (compte anonyme Firebase) ou compte à l'email vérifié.
// Seuils et raisons : docs/security/demo-sessions.md (section Règles).
export type AccountKind = "demo" | "verified";

export interface UsagePlan {
  runsPerMinute: number;
  concurrentRuns: number;
  maxDurationMs: number;
  maxResponseBytes: number;
  // null : pas de limite
  maxWorkflows: number | null;
  keptRunsPerWorkflow: number;
  // Taille des résultats conservés dans l'historique pour une exécution ; null : pas de limite
  maxStoredRunBytes: number | null;
}

export const USAGE_PLANS: Record<AccountKind, UsagePlan> = {
  demo: {
    runsPerMinute: 10,
    concurrentRuns: 1,
    maxDurationMs: 20_000,
    maxResponseBytes: 300_000,
    maxWorkflows: 5,
    keptRunsPerWorkflow: 10,
    maxStoredRunBytes: 500_000,
  },
  verified: {
    runsPerMinute: 30,
    concurrentRuns: 2,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxResponseBytes: MAX_RESPONSE_BYTES,
    maxWorkflows: null,
    keptRunsPerWorkflow: MAX_RUNS_PER_WORKFLOW,
    maxStoredRunBytes: null,
  },
};

// Toutes sessions de démo confondues : en créer de nouvelles ne contourne pas la limite
export const DEMO_RUNS_PER_IP_PER_MINUTE = 20;
