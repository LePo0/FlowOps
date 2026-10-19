import { describe, it, expect, vi } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { createRunsApi } from "./api.ts";

const WORKFLOW = "40dceb9b-d6f8-413e-8d04-80ebd7f7f49d";
const RUN = "5b1f6a0e-2f3c-4a8b-9c1d-7e6f5a4b3c2d";
const summary = {
  id: RUN,
  workflowId: WORKFLOW,
  status: "SUCCESS",
  startedAt: "2026-10-19T14:00:00.000Z",
  durationMs: 12,
};

const respond = (status: number, body: unknown) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );

describe("createRunsApi", () => {
  it("liste les exécutions d'un workflow sans l'enveloppe", async () => {
    const fetchMock = respond(200, { runs: [summary] });

    const result = await createRunsApi(fetchMock).list(WORKFLOW);

    expect(result).toEqual({ ok: true, data: [summary] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/workflows/${WORKFLOW}/runs`);
  });

  it("lit le détail d'une exécution avec son graphe", async () => {
    const run = {
      ...summary,
      graph: sampleWorkflow,
      nodeResults: [{ nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 }],
    };

    const result = await createRunsApi(respond(200, run)).get(RUN);

    expect(result).toEqual({ ok: true, data: run });
  });

  it("ramène une erreur de l'API à son message", async () => {
    const fetchMock = respond(404, {
      errors: [{ code: "NOT_FOUND", message: "Exécution introuvable" }],
    });

    expect(await createRunsApi(fetchMock).get(RUN)).toEqual({
      ok: false,
      message: "Exécution introuvable",
    });
  });
});
