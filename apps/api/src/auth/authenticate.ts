import type { RequestHandler, Response } from "express";
import type { ApiErrorResponse } from "@flowops/shared";
import { InvalidTokenError, type AuthDeps } from "./identity.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      // Renseigné par authenticate() pour toutes les routes /api
      userId?: string;
    }
  }
}

const UNAUTHENTICATED: ApiErrorResponse = {
  errors: [{ code: "UNAUTHENTICATED", message: "Connexion requise" }],
};
const EMAIL_NOT_VERIFIED: ApiErrorResponse = {
  errors: [{ code: "EMAIL_NOT_VERIFIED", message: "Adresse email non vérifiée" }],
};

const BEARER = /^Bearer\s+(\S+)$/i;

// Exige un jeton Firebase valide (en-tête Authorization: Bearer) et rattache la requête au compte
export function authenticate({ verifyToken, users }: AuthDeps): RequestHandler {
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

    // Sans cette vérification, n'importe qui pourrait créer un compte à l'adresse d'un autre.
    // Les comptes Google arrivent vérifiés ; les comptes email/mot de passe après le lien reçu.
    if (!identity.email || !identity.emailVerified) {
      res.status(403).json(EMAIL_NOT_VERIFIED);
      return;
    }

    res.locals.userId = await users.resolve({ ...identity, email: identity.email });
    next();
  };
}

// Utilisateur courant d'une route montée derrière authenticate()
export function currentUserId(res: Response): string {
  const { userId } = res.locals;
  if (!userId) throw new Error("Route /api montée sans authenticate()");
  return userId;
}
