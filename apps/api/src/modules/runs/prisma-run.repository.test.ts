import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_RUNS_PER_WORKFLOW, sampleWorkflow, type NodeResult } from "@flowops/shared";
import { createPrismaClient, type PrismaClient } from "../../db/client.js";
import { createPrismaWorkflowRepository } from "../workflows/prisma-workflow.repository.js";
import { createPrismaRunRepository } from "./prisma-run.repository.js";
import type { NewRun, RunRepository } from "./run.repository.js";

// Test d'intégration sur une vraie base PostgreSQL (TEST_DATABASE_URL), ignoré sans elle
const url = process.env.TEST_DATABASE_URL;

const nodeResults: NodeResult[] = [
  { nodeId: "trigger", status: "SUCCESS", output: {}, durationMs: 0 },
  {
    nodeId: "http1",
    status: "FAILED",
    input: { method: "GET", url: "https://dummyjson.com/products" },
    error: "Connexion refusée par le serveur (ECONNREFUSED)",
    errorDetail: "TypeError: fetch failed",
    durationMs: 12,
  },
  { nodeId: "check", status: "SKIPPED", durationMs: 0 },
  { nodeId: "names", status: "SKIPPED", durationMs: 0 },
];

const newRun = (startedAt = new Date()): NewRun => ({
  status: "FAILED",
  startedAt,
  durationMs: 12,
  graph: sampleWorkflow,
  nodeResults,
});

describe.skipIf(!url)("dépôt Prisma des exécutions (base de test)", () => {
  let prisma: PrismaClient;
  let runs: RunRepository;
  let alice: string;
  let bob: string;
  let workflowId: string;

  beforeAll(() => {
    prisma = createPrismaClient(url ?? "");
    runs = createPrismaRunRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
    alice = (
      await prisma.user.create({ data: { authUid: "uid-alice", email: "alice@test.local" } })
    ).id;
    bob = (await prisma.user.create({ data: { authUid: "uid-bob", email: "bob@test.local" } })).id;
    const workflows = createPrismaWorkflowRepository(prisma);
    workflowId = (await workflows.create(alice, { name: "Démo", graph: sampleWorkflow })).id;
  });

  it("enregistre l'exécution et la relit à l'identique, nœuds dans l'ordre", async () => {
    const recorded = await runs.record(alice, workflowId, newRun());

    const found = await runs.find(alice, recorded?.id ?? "");
    expect(found).toMatchObject({ workflowId, status: "FAILED", graph: sampleWorkflow });
    expect(found?.nodeResults).toEqual(nodeResults);
  });

  it(`ne garde que les ${MAX_RUNS_PER_WORKFLOW} exécutions les plus récentes`, async () => {
    const base = Date.UTC(2026, 9, 19, 8, 0, 0);
    const total = MAX_RUNS_PER_WORKFLOW + 2;
    for (let i = 0; i < total; i++) {
      await runs.record(alice, workflowId, newRun(new Date(base + i * 1000)));
    }

    const kept = (await runs.list(alice, workflowId)) ?? [];
    expect(kept).toHaveLength(MAX_RUNS_PER_WORKFLOW);
    // Les deux plus anciennes ont disparu, avec leurs nœuds (cascade)
    expect(kept.at(-1)?.startedAt).toEqual(new Date(base + 2 * 1000));
    expect(kept[0]?.startedAt).toEqual(new Date(base + (total - 1) * 1000));
    expect(await prisma.nodeRun.count()).toBe(MAX_RUNS_PER_WORKFLOW * nodeResults.length);
  });

  it("refuse d'enregistrer ou de lire l'historique du workflow d'un autre utilisateur", async () => {
    const recorded = await runs.record(alice, workflowId, newRun());

    expect(await runs.record(bob, workflowId, newRun())).toBeNull();
    expect(await runs.list(bob, workflowId)).toBeNull();
    expect(await runs.find(bob, recorded?.id ?? "")).toBeNull();
    expect(await prisma.workflowRun.count()).toBe(1);
  });

  it("supprime l'historique avec le workflow (cascade)", async () => {
    await runs.record(alice, workflowId, newRun());

    await prisma.workflow.delete({ where: { id: workflowId } });

    expect(await prisma.workflowRun.count()).toBe(0);
    expect(await prisma.nodeRun.count()).toBe(0);
  });
});
