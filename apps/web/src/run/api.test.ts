import { describe, it, expect, vi } from "vitest";
import { demoWorkflow } from "@flowops/shared";
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

    const outcome = await postRun(demoWorkflow, fetchMock);

    expect(outcome).toEqual({ kind: "executed", result });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/run");
    expect(JSON.parse(String(init?.body))).toEqual({ graph: demoWorkflow });
  });

  it("transmet les erreurs de l'API avec leurs codes", async () => {
    const errors = [{ code: "CYCLE", message: "Le workflow contient un cycle" }];

    expect(await postRun(demoWorkflow, respond(400, { errors }))).toEqual({
      kind: "rejected",
      errors,
    });
  });

  it("signale une API injoignable", async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect((await postRun(demoWorkflow, failing)).kind).toBe("unavailable");
  });

  it("signale une réponse qui ne respecte pas le contrat", async () => {
    expect(await postRun(demoWorkflow, respond(200, { status: "OK" }))).toMatchObject({
      kind: "unavailable",
      message: "Réponse inattendue de l'API.",
    });
  });

  it("explique une route absente et une erreur sans corps JSON", async () => {
    expect(await postRun(demoWorkflow, respond(404, "Not Found"))).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("désactivée en production"),
    });
    expect(await postRun(demoWorkflow, respond(500, ""))).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("HTTP 500"),
    });
  });

  it("reconnaît une API arrêtée derrière le proxy Vite (502)", async () => {
    expect(await postRun(demoWorkflow, respond(502, ""))).toMatchObject({
      kind: "unavailable",
      message: expect.stringContaining("npm run dev:api"),
    });
  });
});
