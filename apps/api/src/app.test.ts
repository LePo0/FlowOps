import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { InvalidTokenError, type AuthDeps } from "./auth/identity.js";
import { fakeAuth } from "./test-support/fake-auth.js";
import { createMemoryWorkflowRepository } from "./modules/workflows/memory-workflow.repository.js";

const ALICE = "11111111-1111-4111-8111-111111111111";

const appWith = (auth: AuthDeps = fakeAuth) =>
  createApp({ fetch, auth, workflows: createMemoryWorkflowRepository() });

describe("GET /health", () => {
  it("répond 200 avec status ok, sans authentification", async () => {
    const res = await request(appWith()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("authentification des routes /api", () => {
  it("répond 401 sans en-tête Authorization ou avec un autre schéma que Bearer", async () => {
    const app = appWith();

    const missing = await request(app).get("/api/workflows");
    const basic = await request(app).get("/api/workflows").auth("alice", "secret");

    expect(missing.status).toBe(401);
    expect(missing.body.errors[0].code).toBe("UNAUTHENTICATED");
    expect(basic.status).toBe(401);
  });

  it("répond 401 pour un jeton refusé par le vérificateur", async () => {
    const app = appWith({
      ...fakeAuth,
      verifyToken: async () => {
        throw new InvalidTokenError("expiré");
      },
    });

    const res = await request(app).get("/api/workflows").auth("jeton", { type: "bearer" });

    expect(res.status).toBe(401);
  });

  it("répond 500 si la vérification elle-même échoue (clés publiques injoignables)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = appWith({
      ...fakeAuth,
      verifyToken: async () => {
        throw new Error("fetch failed");
      },
    });

    const res = await request(app).get("/api/workflows").auth("jeton", { type: "bearer" });

    expect(res.status).toBe(500);
    expect(res.body.errors[0].code).toBe("INTERNAL_ERROR");
  });

  it("répond 403 si l'email du compte n'est pas vérifié, sans créer l'utilisateur", async () => {
    const resolve = vi.fn(async () => ALICE);
    const app = appWith({
      ...fakeAuth,
      users: { resolve },
      verifyToken: async (token) => ({
        uid: token,
        email: "alice@test.local",
        emailVerified: false,
        name: undefined,
        anonymous: false,
      }),
    });

    const res = await request(app).get("/api/workflows").auth(ALICE, { type: "bearer" });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe("EMAIL_NOT_VERIFIED");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("refuse une requête anonyme avant d'analyser son corps", async () => {
    const res = await request(appWith())
      .post("/api/workflows")
      .set("content-type", "application/json")
      .send("{ pas du json");

    expect(res.status).toBe(401);
  });

  it("protège aussi les routes inconnues, sans révéler ce qui existe", async () => {
    expect((await request(appWith()).get("/api/inconnue")).status).toBe(401);
  });
});

describe("CORS", () => {
  it("n'autorise que l'origine de l'éditeur", async () => {
    const app = appWith();

    const allowed = await request(app).get("/health").set("origin", "http://localhost:5173");
    const other = await request(app).get("/health").set("origin", "https://malveillant.example");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://malveillant.example");
  });
});

describe("diagnostic des en-têtes d'adresse", () => {
  it("journalise les en-têtes d'adresse et l'adresse retenue, seulement s'il est activé", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = (logForwardedFor: boolean) =>
      createApp({ fetch, auth: fakeAuth, trustProxyHops: 1, logForwardedFor });

    await request(app(false)).get("/api/workflows").set("x-forwarded-for", "198.51.100.1");
    expect(log).not.toHaveBeenCalled();

    await request(app(true))
      .get("/api/workflows")
      .set("x-forwarded-for", "198.51.100.1, 203.0.113.7")
      .set("authorization", "Bearer secret");

    const line = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(line).toMatchObject({
      diagnostic: "forwarded-for",
      ip: "203.0.113.7",
      headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.7" },
    });
    // Rien d'autre que les en-têtes d'adresse : ni jeton, ni cookie
    expect(line.headers).not.toHaveProperty("authorization");
    log.mockRestore();
  });
});

describe("cache des réponses /api", () => {
  it("interdit toute mise en cache, y compris pour un refus", async () => {
    const app = appWith();

    const refused = await request(app).get("/api/workflows");
    const allowed = await request(app).get("/api/workflows").auth(ALICE, { type: "bearer" });

    expect(refused.headers["cache-control"]).toBe("no-store");
    expect(allowed.headers["cache-control"]).toBe("no-store");
  });
});
