import type { RequestHandler, Response } from "express";
import type { ApiErrorResponse } from "@flowops/shared";
import { USAGE_PLANS, type AccountKind, type UsagePlan } from "../usage/plans.js";
import { InvalidTokenError, type AuthDeps } from "./identity.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      // Renseignés par authenticate() pour toutes les routes /api
      userId?: string;
      account?: AccountKind;
    }
  }
}

const UNAUTHENTICATED: ApiErrorResponse = {
  errors: [{ code: "UNAUTHENTICATED", message: "Connexion requise" }],
};
const EMAIL_NOT_VERIFIED: ApiErrorResponse = {
  errors: [{ code: "EMAIL_NOT_VERIFIED", message: "Adresse email non vérifiée" }],
};
const DEMO_SESSIONS_DISABLED: ApiErrorResponse = {
  errors: [
    {
      code: "DEMO_SESSIONS_DISABLED",
      message: "Les sessions de démo sont suspendues : connectez-vous avec un compte",
    },
  ],
};

const BEARER = /^Bearer\s+(\S+)$/i;

// Exige un jeton Firebase valide (en-tête Authorization: Bearer) et rattache la requête au compte
export function authenticate({
  verifyToken,
  users,
  demoSessionsEnabled,
}: AuthDeps): RequestHandler {
  return async (req, res, next) => {
    const token = BEARER.exec(req.get("authorization") ?? "")?.[1];
    if (!token) {
      res.status(401).json(UNAUTHENTICATED);
      return;
    }

    let identity;
    try {
      identity = await verifyToken(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        res.status(401).json(UNAUTHENTICATED);
        return;
      }
      throw error;
    }

    if (identity.anonymous) {
      // Session de démo : pas d'email, des quotas plus stricts (docs/security/demo-sessions.md)
      if (!demoSessionsEnabled) {
        res.status(403).json(DEMO_SESSIONS_DISABLED);
        return;
      }
    } else if (!identity.email || !identity.emailVerified) {
      // Sans cette vérification, n'importe qui pourrait créer un compte à l'adresse d'un autre.
      // Les comptes Google arrivent vérifiés ; les comptes email/mot de passe après le lien reçu.
      res.status(403).json(EMAIL_NOT_VERIFIED);
      return;
    }

    res.locals.userId = await users.resolve(identity);
    res.locals.account = identity.anonymous ? "demo" : "verified";
    next();
  };
}

// Utilisateur courant d'une route montée derrière authenticate()
export function currentUserId(res: Response): string {
  const { userId } = res.locals;
  if (!userId) throw new Error("Route /api montée sans authenticate()");
  return userId;
}

// Limites qui s'appliquent au compte courant
export function currentPlan(res: Response): UsagePlan {
  const { account } = res.locals;
  if (!account) throw new Error("Route /api montée sans authenticate()");
  return USAGE_PLANS[account];
}
