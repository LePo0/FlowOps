import { describe, it, expect, beforeEach, vi } from "vitest";
import { as, fakeAuth } from "../../test-support/fake-auth.js";
import type { Express } from "express";
import {
  MAX_RUNS_PER_WORKFLOW,
  RunDetailSchema,
  RunListSchema,
  RunResultSchema,
  sampleWorkflow,
} from "@flowops/shared";
import { createApp } from "../../app.js";
import { createMemoryWorkflowRepository } from "../workflows/memory-workflow.repository.js";
import type { WorkflowRepository } from "../workflows/workflow.repository.js";
import { createMemoryRunRepository } from "./memory-run.repository.js";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

function productsFetch() {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ products: [{ id: 1, title: "A", price: 10 }] }), {
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("historique des exécutions", () => {
  let workflows: WorkflowRepository;
  let fetchMock: ReturnType<typeof productsFetch>;
  let app: Express;
  let workflowId: string;
  // Horloge des limites d'exécution (30 par minute pour un compte vérifié)
  let clock = 0;

  const build = () =>
    createApp({
      fetch: fetchMock,
      auth: fakeAuth,
      workflows,
      runs: createMemoryRunRepository(workflows),
      now: () => clock,
    });
  const run = (id = workflowId, graph: unknown = sampleWorkflow, user = ALICE) =>
    as(app, user).post(`/api/workflows/${id}/runs`).send({ graph });

  beforeEach(async () => {
    workflows = createMemoryWorkflowRepository();
    fetchMock = productsFetch();
    app = build();
    workflowId = (await workflows.create(ALICE, { name: "Démo", graph: sampleWorkflow })).id;
  });

  it("exécute, enregistre et renvoie l'exécution complète", async () => {
    const res = await run();

    expect(res.status).toBe(201);
    const detail = RunDetailSchema.parse(res.body);
    expect(detail).toMatchObject({ workflowId, status: "SUCCESS", graph: sampleWorkflow });
    expect(detail.nodeResults.map((r) => r.nodeId)).toEqual(["trigger", "http1", "check", "names"]);
    expect(res.headers["location"]).toBe(`/api/runs/${detail.id}`);
    // Lisible comme une exécution simple par le front
    expect(RunResultSchema.safeParse(res.body).success).toBe(true);
  });

  it("exécute le graphe envoyé, même s'il diffère de la version enregistrée", async () => {
    const edited = structuredClone(sampleWorkflow);
    edited.nodes[0]!.name = "Modifié sans enregistrer";

    const { body } = await run(workflowId, edited);

    const stored = await as(app, ALICE).get(`/api/runs/${body.id}`);
    expect(stored.body.graph.nodes[0].name).toBe("Modifié sans enregistrer");
  });

  it("liste les exécutions sans le détail, de la plus récente à la plus ancienne", async () => {
    const first = await run();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await run();

    const res = await as(app, ALICE).get(`/api/workflows/${workflowId}/runs`);

    expect(res.status).toBe(200);
    const { runs } = RunListSchema.parse(res.body);
    expect(runs.map((r) => r.id)).toEqual([second.body.id, first.body.id]);
    expect(res.body.runs[0]).not.toHaveProperty("nodeResults");
  });

  it(`ne garde que les ${MAX_RUNS_PER_WORKFLOW} exécutions les plus récentes`, async () => {
    for (let i = 0; i < MAX_RUNS_PER_WORKFLOW + 2; i++) {
      clock += 60_000;
      await run();
    }

    const res = await as(app, ALICE).get(`/api/workflows/${workflowId}/runs`);

    expect(res.body.runs).toHaveLength(MAX_RUNS_PER_WORKFLOW);
  });

  it("n'enregistre pas un graphe invalide et renvoie les codes du moteur", async () => {
    const cyclic = structuredClone(sampleWorkflow);
    cyclic.edges.push({ id: "e4", source: "names", target: "http1" });

    const res = await run(workflowId, cyclic);

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ code: "CYCLE" })]);
    expect((await as(app, ALICE).get(`/api/workflows/${workflowId}/runs`)).body.runs).toEqual([]);
  });

  it("enregistre une exécution en échec : un nœud cassé n'est pas une erreur HTTP", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      }),
    );

    const res = await run();

    expect(res.status).toBe(201);
    const detail = RunDetailSchema.parse(res.body);
    expect(detail.status).toBe("FAILED");
    expect(detail.nodeResults.find((r) => r.nodeId === "http1")).toMatchObject({
      status: "FAILED",
      error: "Connexion refusée par le serveur (ECONNREFUSED)",
    });
    const stored = await as(app, ALICE).get(`/api/runs/${detail.id}`);
    expect(stored.body).toEqual(res.body);
  });

  it("refuse un corps sans graphe, sans rien exécuter ni enregistrer", async () => {
    for (const body of [{}, { graph: "pas un graphe" }, { graph: null }]) {
      const res = await as(app, ALICE).post(`/api/workflows/${workflowId}/runs`).send(body);

      expect(res.status).toBe(400);
      expect(res.body.errors[0].code).toBe("INVALID_BODY");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await as(app, ALICE).get(`/api/workflows/${workflowId}/runs`)).body.runs).toEqual([]);
  });

  it("vérifie la propriété avant le corps : un corps invalide sur le workflow d'autrui donne 404", async () => {
    const res = await as(app, BOB).post(`/api/workflows/${workflowId}/runs`).send({});

    expect(res.status).toBe(404);
  });

  it("répond 404 si le workflow est supprimé pendant l'exécution, sans rien enregistrer", async () => {
    fetchMock.mockImplementation(async () => {
      await workflows.remove(ALICE, workflowId);
      return new Response(JSON.stringify({ products: [] }), {
        headers: { "content-type": "application/json" },
      });
    });

    const res = await run();

    expect(res.status).toBe(404);
    expect(res.body.errors[0].code).toBe("NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("n'exécute rien pour un workflow inconnu ou appartenant à un autre utilisateur", async () => {
    expect((await run(UNKNOWN)).status).toBe(404);
    expect((await run("pas-un-uuid")).status).toBe(404);
    expect((await run(workflowId, sampleWorkflow, BOB)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cache l'historique et les exécutions d'un autre utilisateur", async () => {
    const { body } = await run();

    expect((await as(app, BOB).get(`/api/workflows/${workflowId}/runs`)).status).toBe(404);
    expect((await as(app, BOB).get(`/api/runs/${body.id}`)).status).toBe(404);
    expect((await as(app, ALICE).get(`/api/runs/${UNKNOWN}`)).body.errors[0].code).toBe(
      "NOT_FOUND",
    );
  });
});
