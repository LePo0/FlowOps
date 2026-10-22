import { describe, it, expect, vi } from "vitest";
import { createAuthFetch } from "./auth-fetch.ts";

const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response(null, { status }));

describe("createAuthFetch", () => {
  it("ajoute le jeton sans perdre les en-têtes de l'appel", async () => {
    const fetchMock = respond(200);
    const authFetch = createAuthFetch(
      async () => "jeton-123",
      { onUnauthorized: vi.fn() },
      fetchMock,
    );

    await authFetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer jeton-123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("n'envoie pas d'en-tête Authorization sans utilisateur connecté", async () => {
    const fetchMock = respond(200);

    await createAuthFetch(
      async () => null,
      { onUnauthorized: vi.fn() },
      fetchMock,
    )("/api/workflows");

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("signale un 401 et renvoie quand même la réponse à l'appelant", async () => {
    const onUnauthorized = vi.fn();

    const response = await createAuthFetch(
      async () => "x",
      { onUnauthorized },
      respond(401),
    )("/api");

    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
  });

  it("ne signale rien pour les autres erreurs (403, 404, 500)", async () => {
    const onUnauthorized = vi.fn();

    for (const status of [403, 404, 500]) {
      await createAuthFetch(async () => "x", { onUnauthorized }, respond(status))("/api");
    }

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("signale le refus des sessions de démo, et laisse le corps lisible", async () => {
    const onDemoRefused = vi.fn();
    const body = { errors: [{ code: "DEMO_SESSIONS_DISABLED", message: "Suspendues" }] };
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(body), { status: 403 }),
    );

    const response = await createAuthFetch(
      async () => "x",
      { onUnauthorized: vi.fn(), onDemoRefused },
      fetchMock,
    )("/api");

    expect(onDemoRefused).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual(body);
  });

  it("ne prend pas un autre 403 pour un refus des sessions de démo", async () => {
    const onDemoRefused = vi.fn();
    const body = { errors: [{ code: "QUOTA_EXCEEDED", message: "Trop de workflows" }] };

    await createAuthFetch(
      async () => "x",
      { onUnauthorized: vi.fn(), onDemoRefused },
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 403 })),
    )("/api");

    expect(onDemoRefused).not.toHaveBeenCalled();
  });
});
