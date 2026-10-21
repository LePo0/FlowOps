import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleWorkflow } from "@flowops/shared";
import { createPrismaClient, type PrismaClient } from "../db/client.js";
import {
  createPrismaDemoSessionCleaner,
  DEMO_SESSION_MAX_IDLE_MS,
  scheduleDemoSessionCleanup,
} from "./cleanup.js";

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const silent = { info: vi.fn(), error: vi.fn() };

describe("planification du nettoyage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nettoie au démarrage puis toutes les heures, avec la limite de 7 jours", async () => {
    vi.useFakeTimers();
    const deleteInactive = vi.fn(async () => 0);

    const stop = scheduleDemoSessionCleanup(deleteInactive, { now: () => NOW, log: silent });
    expect(deleteInactive).toHaveBeenCalledWith(new Date(NOW - DEMO_SESSION_MAX_IDLE_MS));

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(deleteInactive).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(deleteInactive).toHaveBeenCalledTimes(2);
  });

  it("journalise un échec sans arrêter l'API", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const stop = scheduleDemoSessionCleanup(
      async () => {
        throw new Error("base injoignable");
      },
      { now: () => NOW, log },
    );

    await vi.waitFor(() => expect(log.error).toHaveBeenCalled());
    stop();
  });
});

// Test d'intégration sur une vraie base PostgreSQL (TEST_DATABASE_URL), ignoré sans elle
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("suppression des sessions de démo inactives (base de test)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient(url ?? "");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
  });

  const user = (authUid: string, isAnonymous: boolean, idleDays: number) =>
    prisma.user.create({
      data: {
        authUid,
        isAnonymous,
        email: isAnonymous ? null : `${authUid}@test.local`,
        lastSeenAt: new Date(NOW - idleDays * 24 * 60 * 60 * 1000),
        workflows: { create: { name: "W", graphJson: sampleWorkflow } },
      },
    });

  it("N1, N2 : supprime les sessions inactives et leurs workflows, garde le reste", async () => {
    await user("demo-ancienne", true, 8);
    await user("demo-recente", true, 6);
    await user("compte-inactif", false, 30);

    const count = await createPrismaDemoSessionCleaner(prisma)(
      new Date(NOW - DEMO_SESSION_MAX_IDLE_MS),
    );

    expect(count).toBe(1);
    const left = await prisma.user.findMany({
      select: { authUid: true },
      orderBy: { authUid: "asc" },
    });
    expect(left.map((row) => row.authUid)).toEqual(["compte-inactif", "demo-recente"]);
    expect(await prisma.workflow.count()).toBe(2);
  });
});
