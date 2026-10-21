import request from "supertest";
import type { Express } from "express";
import type { AuthDeps } from "../auth/identity.js";

// Authentification de test : le jeton est l'identifiant de l'utilisateur. Un jeton qui commence
// par « demo- » est celui d'une session de démo (compte anonyme). Les requêtes passent quand même
// par le vrai middleware (en-tête Authorization, email vérifié, userId, type de compte).
export const fakeAuth: AuthDeps = {
  verifyToken: async (token) => {
    const anonymous = token.startsWith("demo-");
    return {
      uid: token,
      email: anonymous ? undefined : `${token}@test.local`,
      emailVerified: !anonymous,
      name: undefined,
      anonymous,
    };
  },
  users: { resolve: async ({ uid }) => uid },
  demoSessionsEnabled: true,
};

// Client Supertest connecté en tant que `userId`
export const as = (app: Express, userId: string) =>
  request.agent(app).auth(userId, { type: "bearer" });
