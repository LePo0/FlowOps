import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { createPrismaClient, type PrismaClient } from "../../db/client.js";
import { createPrismaWorkflowRepository } from "./prisma-workflow.repository.js";
import type { WorkflowRepository } from "./workflow.repository.js";

// Test d'intégration sur une vraie base PostgreSQL (TEST_DATABASE_URL), ignoré sans elle
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("dépôt Prisma des workflows (base de test)", () => {
  let prisma: PrismaClient;
  let repository: WorkflowRepository;
  let alice: string;
  let bob: string;

  beforeAll(() => {
    prisma = createPrismaClient(url ?? "");
    repository = createPrismaWorkflowRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Base vide à chaque test ; CASCADE vide aussi workflows et exécutions
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
    alice = (await prisma.user.create({ data: { email: "alice@test.local" } })).id;
    bob = (await prisma.user.create({ data: { email: "bob@test.local" } })).id;
  });

  it("enregistre le graphe en JSONB et le relit à l'identique", async () => {
    const created = await repository.create(alice, { name: "Démo", graph: sampleWorkflow });

    const found = await repository.find(alice, created.id);
    expect(found?.graph).toEqual(sampleWorkflow);
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("liste les workflows d'un utilisateur, du plus récent au plus ancien", async () => {
    const first = await repository.create(alice, { name: "Premier", graph: sampleWorkflow });
    await repository.create(alice, { name: "Second", graph: sampleWorkflow });
    await repository.create(bob, { name: "À Bob", graph: sampleWorkflow });
    await repository.update(alice, first.id, { name: "Premier modifié", graph: sampleWorkflow });

    const names = (await repository.list(alice)).map((workflow) => workflow.name);
    expect(names).toEqual(["Premier modifié", "Second"]);
  });

  it("ne lit, ne modifie ni ne supprime le workflow d'un autre utilisateur", async () => {
    const { id } = await repository.create(alice, { name: "À Alice", graph: sampleWorkflow });

    expect(await repository.find(bob, id)).toBeNull();
    expect(await repository.update(bob, id, { name: "Volé", graph: sampleWorkflow })).toBeNull();
    expect(await repository.remove(bob, id)).toBe(false);
    expect((await repository.find(alice, id))?.name).toBe("À Alice");
  });

  it("supprime un workflow, puis ne le trouve plus", async () => {
    const { id } = await repository.create(alice, { name: "Éphémère", graph: sampleWorkflow });

    expect(await repository.remove(alice, id)).toBe(true);
    expect(await repository.find(alice, id)).toBeNull();
    expect(await repository.remove(alice, id)).toBe(false);
  });

  it("supprime les workflows d'un utilisateur supprimé (cascade)", async () => {
    await repository.create(alice, { name: "Démo", graph: sampleWorkflow });

    await prisma.user.delete({ where: { id: alice } });

    expect(await prisma.workflow.count()).toBe(0);
  });

  it("refuse de relire un graphe corrompu en base", async () => {
    const { id } = await prisma.workflow.create({
      data: { userId: alice, name: "Corrompu", graphJson: { nodes: "pas une liste" } },
    });

    await expect(repository.find(alice, id)).rejects.toThrow();
  });
});
