import request from "supertest";
import type { Express } from "express";
import type { AuthDeps } from "../auth/identity.js";

// Authentification de test : le jeton est l'identifiant de l'utilisateur. Les requêtes passent
// quand même par le vrai middleware (en-tête Authorization, email vérifié, userId).
export const fakeAuth: AuthDeps = {
  verifyToken: async (token) => ({
    uid: token,
    email: `${token}@test.local`,
    emailVerified: true,
    name: undefined,
  }),
  users: { resolve: async ({ uid }) => uid },
};

// Client Supertest connecté en tant que `userId`
export const as = (app: Express, userId: string) =>
  request.agent(app).auth(userId, { type: "bearer" });
