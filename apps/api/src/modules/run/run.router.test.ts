import { describe, it, expect, vi } from "vitest";
import { as, fakeAuth } from "../../test-support/fake-auth.js";
import { sampleWorkflow } from "@flowops/shared";
import { createApp } from "../../app.js";

const USER = "11111111-1111-4111-8111-111111111111";

function jsonFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

function appWith(fetchImpl: typeof fetch) {
  return createApp({ fetch: fetchImpl, auth: fakeAuth });
}

describe("POST /api/run", () => {
  it("exécute le workflow d'exemple et répond 200 avec les résultats par nœud", async () => {
    const fetchMock = jsonFetch(200, { products: [{ id: 1, title: "A", price: 10 }] });

    const res = await as(appWith(fetchMock), USER).post("/api/run").send({ graph: sampleWorkflow });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SUCCESS");
    expect(typeof res.body.durationMs).toBe("number");
    expect(res.body.nodeResults.map((r: { status: string }) => r.status)).toEqual([
      "SUCCESS",
      "SUCCESS",
      "SUCCESS",
      "SUCCESS",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("répond 400 si le corps n'a pas de graphe", async () => {
    const fetchMock = jsonFetch(200, {});

    const res = await as(appWith(fetchMock), USER).post("/api/run").send({ nodes: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe("INVALID_BODY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("répond 400 avec le code CYCLE pour un graphe cyclique", async () => {
    const fetchMock = jsonFetch(200, {});
    const graph = structuredClone(sampleWorkflow);
    graph.edges.push({ id: "e4", source: "names", target: "http1" });

    const res = await as(appWith(fetchMock), USER).post("/api/run").send({ graph });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ code: "CYCLE" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("répond 200 avec status FAILED sur une erreur réseau", async () => {
    const failingFetch = vi.fn<typeof fetch>(async () => {
      // Même forme que fetch (undici) : la raison réelle est dans `cause`
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      });
    });

    const res = await as(appWith(failingFetch), USER)
      .post("/api/run")
      .send({ graph: sampleWorkflow });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED");
    expect(res.body.nodeResults).toContainEqual(
      expect.objectContaining({
        nodeId: "http1",
        status: "FAILED",
        error: "Connexion refusée par le serveur (ECONNREFUSED)",
      }),
    );
  });

  it("répond 400 en JSON propre pour un JSON mal formé", async () => {
    const res = await as(appWith(jsonFetch(200, {})), USER)
      .post("/api/run")
      .set("Content-Type", "application/json")
      .send('{"graph":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ errors: [{ code: "INVALID_JSON", message: "JSON mal formé" }] });
  });

  it("répond 413 pour un corps de plus de 1 Mo", async () => {
    const res = await as(appWith(jsonFetch(200, {})), USER)
      .post("/api/run")
      .send({ graph: sampleWorkflow, padding: "x".repeat(1024 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.errors[0].code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("exécute avec le fetch fourni à l'application, quel que soit l'environnement", async () => {
    // En production, index.ts fournit le fetch gardé par la politique réseau
    const fetchMock = jsonFetch(200, { products: [] });

    const res = await as(createApp({ fetch: fetchMock, auth: fakeAuth }), USER)
      .post("/api/run")
      .send({ graph: sampleWorkflow });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
