import { describe, it, expect, beforeEach } from "vitest";
import { as, fakeAuth } from "../../test-support/fake-auth.js";
import type { Express } from "express";
import { sampleWorkflow, WorkflowDetailSchema, WorkflowListSchema } from "@flowops/shared";
import { createApp } from "../../app.js";
import { createMemoryWorkflowRepository } from "./memory-workflow.repository.js";
import type { WorkflowRepository } from "./workflow.repository.js";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

// L'utilisateur courant est lu dans un en-tête de test : simule deux comptes distincts
function testApp(repository: WorkflowRepository): Express {
  return createApp({
    fetch,
    auth: fakeAuth,
    workflows: repository,
  });
}

describe("/api/workflows", () => {
  let app: Express;

  beforeEach(() => {
    app = testApp(createMemoryWorkflowRepository());
  });

  const create = (name = "Démo", graph: unknown = sampleWorkflow, user = ALICE) =>
    as(app, user).post("/api/workflows").send({ name, graph });

  it("crée un workflow et le relit à l'identique", async () => {
    const created = await create("  Pokémons  ");

    expect(created.status).toBe(201);
    const detail = WorkflowDetailSchema.parse(created.body);
    expect(detail.name).toBe("Pokémons");
    expect(created.headers["location"]).toBe(`/api/workflows/${detail.id}`);

    const read = await as(app, ALICE).get(`/api/workflows/${detail.id}`);
    expect(read.status).toBe(200);
    expect(WorkflowDetailSchema.parse(read.body).graph).toEqual(sampleWorkflow);
  });

  it("liste les workflows sans leur graphe, du plus récent au plus ancien", async () => {
    await create("Premier");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await create("Second");

    const res = await as(app, ALICE).get("/api/workflows");

    expect(res.status).toBe(200);
    const { workflows } = WorkflowListSchema.parse(res.body);
    expect(workflows.map((workflow) => workflow.name)).toEqual(["Second", "Premier"]);
    expect(res.body.workflows[0]).not.toHaveProperty("graph");
  });

  it("met à jour le nom et le graphe", async () => {
    const { body } = await create();
    const graph = structuredClone(sampleWorkflow);
    graph.nodes[0]!.name = "Départ";

    const res = await as(app, ALICE)
      .put(`/api/workflows/${body.id}`)
      .send({ name: "Renommé", graph });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renommé");
    expect(res.body.graph.nodes[0].name).toBe("Départ");
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThanOrEqual(Date.parse(body.updatedAt));
  });

  it("supprime un workflow", async () => {
    const { body } = await create();

    expect((await as(app, ALICE).delete(`/api/workflows/${body.id}`)).status).toBe(204);
    expect((await as(app, ALICE).get(`/api/workflows/${body.id}`)).status).toBe(404);
  });

  it("refuse un nom vide ou un graphe invalide avec des messages par champ", async () => {
    const res = await create("   ", { nodes: [], edges: [] });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map(
      (error: { message: string }) => error.message.split(" :")[0],
    );
    expect(fields).toEqual(["name", "graph.nodes"]);
    expect(res.body.errors[0].code).toBe("INVALID_BODY");
  });

  it("répond 404 pour un identifiant inconnu ou mal formé", async () => {
    const unknown = "33333333-3333-4333-8333-333333333333";

    expect((await as(app, ALICE).get(`/api/workflows/${unknown}`)).status).toBe(404);
    expect((await as(app, ALICE).get("/api/workflows/pas-un-uuid")).status).toBe(404);
    const put = await as(app, ALICE)
      .put("/api/workflows/pas-un-uuid")
      .send({ name: "x", graph: sampleWorkflow });
    expect(put.status).toBe(404);
    expect(put.body.errors[0].code).toBe("NOT_FOUND");
  });

  it("isole les workflows de chaque utilisateur", async () => {
    const { body } = await create("À Alice", sampleWorkflow, ALICE);

    expect((await as(app, BOB).get("/api/workflows")).body.workflows).toEqual([]);
    expect((await as(app, BOB).get(`/api/workflows/${body.id}`)).status).toBe(404);
    expect(
      (
        await as(app, BOB).put(`/api/workflows/${body.id}`).send({
          name: "Volé",
          graph: sampleWorkflow,
        })
      ).status,
    ).toBe(404);
    expect((await as(app, BOB).delete(`/api/workflows/${body.id}`)).status).toBe(404);

    const stillThere = await as(app, ALICE).get(`/api/workflows/${body.id}`);
    expect(stillThere.body.name).toBe("À Alice");
  });

  it("n'est pas montée sans dépôt", async () => {
    const withoutDb = createApp({ fetch, auth: fakeAuth });

    expect((await as(withoutDb, ALICE).get("/api/workflows")).status).toBe(404);
  });
});
