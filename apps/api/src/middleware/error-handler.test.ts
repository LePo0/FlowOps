import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "./error-handler.js";

describe("errorHandler", () => {
  it("répond 500 sans stack trace ni détail interne pour une erreur inattendue", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/boom", () => {
      throw new Error("secret: mot de passe de la base");
    });
    app.use(errorHandler);

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errors: [{ code: "INTERNAL_ERROR", message: "Erreur interne" }] });
    expect(res.text).not.toContain("secret");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("laisse Express couper la connexion si la réponse a déjà commencé", async () => {
    const app = express();
    app.get("/flux", (_req, res, next) => {
      res.status(200).write("début");
      next(new Error("échec au milieu du flux"));
    });
    const reached = vi.fn();
    app.use(errorHandler);
    // Gestionnaire d'Express suivant : il reçoit l'erreur au lieu d'une seconde réponse JSON.
    // Express ne le reconnaît comme gestionnaire d'erreurs qu'avec ses quatre paramètres.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use(((err, _req, res, _next) => {
      reached(err);
      res.end();
    }) as express.ErrorRequestHandler);

    const res = await request(app).get("/flux");

    expect(res.status).toBe(200);
    expect(res.text).toBe("début");
    expect(reached).toHaveBeenCalledWith(
      expect.objectContaining({ message: "échec au milieu du flux" }),
    );
  });
});
