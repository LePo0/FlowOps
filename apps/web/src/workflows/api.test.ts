import { describe, it, expect, vi } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { createWorkflowsApi } from "./api.ts";

const detail = {
  id: "40dceb9b-d6f8-413e-8d04-80ebd7f7f49d",
  name: "Démo",
  createdAt: "2026-10-16T14:29:25.728Z",
  updatedAt: "2026-10-16T14:29:25.728Z",
  graph: sampleWorkflow,
};

function respond(status: number, body?: unknown) {
  return vi.fn<typeof fetch>(async () =>
    body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
  );
}

describe("createWorkflowsApi", () => {
  it("crée un workflow en envoyant nom et graphe en JSON", async () => {
    const fetchMock = respond(201, detail);

    const result = await createWorkflowsApi(fetchMock).create({
      name: "Démo",
      graph: sampleWorkflow,
    });

    expect(result).toEqual({ ok: true, data: detail });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/workflows");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Démo", graph: sampleWorkflow });
  });

  it("renvoie la liste sans l'enveloppe", async () => {
    const { id, name, createdAt, updatedAt } = detail;
    const summary = { id, name, createdAt, updatedAt };
    const result = await createWorkflowsApi(respond(200, { workflows: [summary] })).list();

    expect(result).toEqual({ ok: true, data: [summary] });
  });

  it("supprime avec une réponse 204 sans corps", async () => {
    const fetchMock = respond(204);

    expect(await createWorkflowsApi(fetchMock).remove(detail.id)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/workflows/${detail.id}`);
  });

  it("ramène les erreurs de l'API à un message", async () => {
    const errors = [
      { code: "INVALID_BODY", message: "name : trop court" },
      { code: "INVALID_BODY", message: "graph.nodes : liste vide" },
    ];

    expect(await createWorkflowsApi(respond(400, { errors })).get(detail.id)).toEqual({
      ok: false,
      message: "name : trop court ; graph.nodes : liste vide",
    });
  });

  it("signale une API arrêtée, un serveur injoignable et une réponse hors contrat", async () => {
    expect(await createWorkflowsApi(respond(502)).list()).toMatchObject({
      ok: false,
      message: expect.stringContaining("npm run dev:api"),
    });

    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await createWorkflowsApi(failing).list()).toEqual({
      ok: false,
      message: "Impossible de joindre le serveur.",
    });

    expect(await createWorkflowsApi(respond(200, { name: "sans id" })).get("x")).toEqual({
      ok: false,
      message: "Réponse inattendue de l'API.",
    });
  });
});
