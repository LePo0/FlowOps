import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { demoWorkflow } from "@flowops/shared";
import { createApp } from "../../app.js";

function jsonFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

function devApp(fetchImpl: typeof fetch) {
  return createApp({ fetch: fetchImpl, nodeEnv: "development" });
}

describe("POST /api/run", () => {
  it("exécute le workflow de démo et répond 200 avec les résultats par nœud", async () => {
    const fetchMock = jsonFetch(200, { products: [{ id: 1, title: "A", price: 10 }] });

    const res = await request(devApp(fetchMock)).post("/api/run").send({ graph: demoWorkflow });

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

    const res = await request(devApp(fetchMock)).post("/api/run").send({ nodes: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe("INVALID_BODY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("répond 400 avec le code CYCLE pour un graphe cyclique", async () => {
    const fetchMock = jsonFetch(200, {});
    const graph = structuredClone(demoWorkflow);
    graph.edges.push({ id: "e4", source: "names", target: "http1" });

    const res = await request(devApp(fetchMock)).post("/api/run").send({ graph });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ code: "CYCLE" })]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("répond 200 avec status FAILED sur une erreur réseau", async () => {
    const failingFetch = vi.fn<typeof fetch>(async () => {
      throw new Error("ECONNREFUSED");
    });

    const res = await request(devApp(failingFetch)).post("/api/run").send({ graph: demoWorkflow });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED");
    expect(res.body.nodeResults).toContainEqual(
      expect.objectContaining({ nodeId: "http1", status: "FAILED", error: "ECONNREFUSED" }),
    );
  });

  it("répond 400 en JSON propre pour un JSON mal formé", async () => {
    const res = await request(devApp(jsonFetch(200, {})))
      .post("/api/run")
      .set("Content-Type", "application/json")
      .send('{"graph":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ errors: [{ code: "INVALID_JSON", message: "JSON mal formé" }] });
  });

  it("répond 413 pour un corps de plus de 1 Mo", async () => {
    const res = await request(devApp(jsonFetch(200, {})))
      .post("/api/run")
      .send({ graph: demoWorkflow, padding: "x".repeat(1024 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.errors[0].code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("n'est pas montée en production", async () => {
    const fetchMock = jsonFetch(200, {});
    const app = createApp({ fetch: fetchMock, nodeEnv: "production" });

    const res = await request(app).post("/api/run").send({ graph: demoWorkflow });

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
