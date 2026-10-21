import { describe, expect, it } from "vitest";
import type { Env } from "./env.js";
import { describeDatabaseError, loadServerConfig } from "./server-config.js";

const complete: Env = {
  NODE_ENV: "production",
  PORT: 3000,
  CORS_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://flowops:secret@db.local:5432/flowops",
  FIREBASE_PROJECT_ID: "flowops-test",
  FIREBASE_AUTH_EMULATOR_HOST: undefined,
  HTTP_ALLOWED_TARGETS: "",
  HTTP_DENIED_TARGETS: "",
};

function refusal(env: Env): string {
  const result = loadServerConfig(env);
  if (result.ok) throw new Error("Le démarrage aurait dû être refusé");
  return result.error;
}

describe("configuration de démarrage du serveur", () => {
  it("démarre en mode par défaut : adresses publiques seules", () => {
    const result = loadServerConfig(complete);

    if (!result.ok) throw new Error(result.error);
    expect(result.config).toMatchObject({
      databaseUrl: complete.DATABASE_URL,
      firebaseProjectId: "flowops-test",
    });
    expect(result.config.networkPolicy.decide("exemple.test", "93.184.216.34")).toBe("allow");
    expect(result.config.networkPolicy.decide("exemple.test", "10.0.0.5")).toBe("deny");
  });

  it("applique les listes réseau de l'administrateur", () => {
    const result = loadServerConfig({
      ...complete,
      HTTP_ALLOWED_TARGETS: "10.20.0.0/16",
      HTTP_DENIED_TARGETS: "10.20.99.0/24",
    });

    if (!result.ok) throw new Error(result.error);
    expect(result.config.networkPolicy.decide("exemple.test", "10.20.1.5")).toBe("allow");
    expect(result.config.networkPolicy.decide("exemple.test", "10.20.99.5")).toBe("deny");
  });

  it("refuse de démarrer sans base ni projet Firebase, en citant chaque variable", () => {
    const error = refusal({ ...complete, DATABASE_URL: undefined, FIREBASE_PROJECT_ID: undefined });

    expect(error).toContain("DATABASE_URL");
    expect(error).toContain("FIREBASE_PROJECT_ID");
    expect(refusal({ ...complete, FIREBASE_PROJECT_ID: undefined })).not.toContain("DATABASE_URL");
  });

  it("vérifie les vrais jetons Google par défaut", () => {
    const result = loadServerConfig(complete);

    expect(result.ok && result.config.authEmulatorHost).toBeUndefined();
  });

  it("accepte l'émulateur Firebase hors production, pour un projet demo-*", () => {
    const result = loadServerConfig({
      ...complete,
      NODE_ENV: "test",
      FIREBASE_PROJECT_ID: "demo-flowops",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    });

    expect(result.ok && result.config.authEmulatorHost).toBe("127.0.0.1:9099");
  });

  it("refuse l'émulateur Firebase en production, même pour un projet demo-*", () => {
    const error = refusal({
      ...complete,
      FIREBASE_PROJECT_ID: "demo-flowops",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    });

    expect(error).toContain("interdite en production");
  });

  it("refuse l'émulateur Firebase avec un vrai projet", () => {
    const error = refusal({
      ...complete,
      NODE_ENV: "development",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    });

    expect(error).toContain("projet de démonstration");
    expect(error).toContain("flowops-test");
  });

  it.each([
    ["HTTP_ALLOWED_TARGETS", "10.20.0.0/33"],
    ["HTTP_DENIED_TARGETS", "pas une cible"],
  ])("[K1] refuse de démarrer avec %s=%s, en citant l'entrée", (variable, entry) => {
    const error = refusal({ ...complete, [variable]: entry });

    expect(error).toMatch(/^HTTP_ALLOWED_TARGETS ou HTTP_DENIED_TARGETS : /);
    expect(error).toContain(entry);
  });
});

describe("message d'échec du premier accès à la base", () => {
  const url = "postgresql://flowops:secret@db.local:5433/flowops";

  it("dit comment démarrer une base injoignable, sans le mot de passe", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

    const message = describeDatabaseError(refused, url);

    expect(message).toBe(
      "Base de données injoignable sur db.local:5433. En local, démarrez-la avec : npm run db:start",
    );
    expect(message).not.toContain("secret");
  });

  it("donne le code et le message pour toute autre erreur", () => {
    const denied = Object.assign(new Error("password authentication failed"), { code: "28P01" });

    expect(describeDatabaseError(denied, url)).toBe(
      "Accès à la base de données impossible (28P01) : password authentication failed",
    );
    expect(describeDatabaseError("bizarre", url)).toBe(
      "Accès à la base de données impossible (erreur inconnue) : bizarre",
    );
  });
});
