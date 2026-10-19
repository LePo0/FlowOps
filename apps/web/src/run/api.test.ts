import { describe, it, expect, vi } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { postRun } from "./api.ts";

function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () =>
    typeof body === "string"
      ? new Response(body, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
  );
}

describe("postRun", () => {
  it("envoie le graphe et renvoie le résultat d'exécution", async () => {
    const result = {
      status: "SUCCESS",
      durationMs: 12,
      nodeResults: [{ nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 }],
    };
    const fetchMock = respond(200, result);

    const outcome = await postRun(sampleWorkflow, { fetchImpl: fetchMock });

    expect(outcome).toEqual({ kind: "executed", result });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/run");
    expect(JSON.parse(String(init?.body))).toEqual({ graph: sampleWorkflow });
  });

  it("historise l'exécution d'un workflow enregistré et garde son identifiant", async () => {
    const workflowId = "40dceb9b-d6f8-413e-8d04-80ebd7f7f49d";
    const runId = "7a1c4f0e-2b3d-4e5f-8a9b-0c1d2e3f4a5b";
    const nodeResults = [{ nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 }];
    const fetchMock = respond(201, {
      id: runId,
      workflowId,
      status: "SUCCESS",
      startedAt: "2026-10-19T08:00:00.000Z",
      durationMs: 12,
      graph: sampleWorkflow,
      nodeResults,
    });

    const outcome = await postRun(sampleWorkflow, { workflowId, fetchImpl: fetchMock });

    expect(outcome).toEqual({
      kind: "executed",
      result: { status: "SUCCESS", durationMs: 12, nodeResults },
      runId,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/workflows/${workflowId}/runs`);
  });

  it("transmet les erreurs de l'API avec leurs codes", async () => {
    const errors = [{ code: "CYCLE", message: "Le workflow contient un cycle" }];

    expect(await postRun(sampleWorkflow, { fetchImpl: respond(400, { errors }) })).toEqual({
      kind: "rejected",
      errors,
    });
  });

  it("signale une API injoignable", async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect((await postRun(sampleWorkflow, { fetchImpl: failing })).kind).toBe("unavailable");
  });

  it("signale une réponse qui ne respecte pas le contrat", async () => {
    expect(
      await postRun(sampleWorkflow, { fetchImpl: respond(200, { status: "OK" }) }),
    ).toMatchObject({
      kind: "unavailable",
      message: "Réponse inattendue de l'API.",
    });
  });

  it("explique une route absente et une erreur sans corps JSON", async () => {
    expect(await postRun(sampleWorkflow, { fetchImpl: respond(404, "Not Found") })).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("désactivée en production"),
    });
    expect(await postRun(sampleWorkflow, { fetchImpl: respond(500, "") })).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("HTTP 500"),
    });
  });

  it("reconnaît une API arrêtée derrière le proxy Vite (502)", async () => {
    expect(await postRun(sampleWorkflow, { fetchImpl: respond(502, "") })).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("npm run dev:api"),
    });
  });
});
