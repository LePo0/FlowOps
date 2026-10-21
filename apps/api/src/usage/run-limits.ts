import type { RequestHandler, Response } from "express";
import type { ApiErrorResponse } from "@flowops/shared";
import { currentPlan, currentUserId } from "../auth/authenticate.js";
import { createConcurrencyLimiter, createRateLimiter, ipKey } from "./limiters.js";
import { DEMO_RUNS_PER_IP_PER_MINUTE } from "./plans.js";

const MINUTE_MS = 60_000;

function tooManyRuns(res: Response, retryAfterSeconds: number, message: string) {
  const body: ApiErrorResponse = { errors: [{ code: "RATE_LIMITED", message }] };
  res.status(429).set("Retry-After", String(retryAfterSeconds)).json(body);
}

/**
 * Limite les exécutions (POST /api/run et POST /api/workflows/:id/runs), avant toute lecture du
 * graphe : une requête refusée n'appelle aucune URL. Scénarios Q1 à Q3, Q8, Q9.
 * Une instance par application : chaque test repart de compteurs vides.
 */
export function createRunLimits(now = () => Date.now()): RequestHandler {
  const perAccount = createRateLimiter(MINUTE_MS, now);
  const perIp = createRateLimiter(MINUTE_MS, now);
  const running = createConcurrencyLimiter();

  return (req, res, next) => {
    const userId = currentUserId(res);
    const plan = currentPlan(res);

    const account = perAccount.hit(userId, plan.runsPerMinute);
    if (!account.ok) {
      tooManyRuns(res, account.retryAfterSeconds, "Trop d'exécutions : réessayez dans un instant");
      return;
    }
    // req.ip tient compte de « trust proxy » : derrière Cloud Run, l'adresse ajoutée par Google
    if (res.locals.account === "demo") {
      const ip = perIp.hit(ipKey(req.ip), DEMO_RUNS_PER_IP_PER_MINUTE);
      if (!ip.ok) {
        tooManyRuns(res, ip.retryAfterSeconds, "Trop d'exécutions depuis cette adresse");
        return;
      }
    }

    const release = running.acquire(userId, plan.concurrentRuns);
    if (!release) {
      tooManyRuns(res, 1, "Une exécution est déjà en cours");
      return;
    }
    // « close » arrive aussi quand le client abandonne la requête : sa place se libère alors que
    // l'exécution peut continuer jusqu'à son échéance. La limite par minute borne ce cas.
    res.on("close", release);
    next();
  };
}
