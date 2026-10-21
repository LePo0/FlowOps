import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "../db/client.js";
import { DEMO_EXAMPLES } from "../demo/examples.js";
import type { UserDirectory } from "./identity.js";
import { createPrismaUserDirectory, LAST_SEEN_PRECISION_MS } from "./prisma-user-directory.js";

// Test d'intégration sur une vraie base PostgreSQL (TEST_DATABASE_URL), ignoré sans elle
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("annuaire Prisma des utilisateurs (base de test)", () => {
  let prisma: PrismaClient;
  let users: UserDirectory;
  const alice = {
    uid: "uid-alice",
    email: "alice@test.local",
    emailVerified: true,
    name: "Alice",
    anonymous: false,
  };

  // Session de démo : compte anonyme Firebase, sans email
  const visitor = {
    uid: "uid-visiteur",
    email: undefined,
    emailVerified: false,
    name: undefined,
    anonymous: true,
  };
  let clock: Date;

  beforeAll(() => {
    prisma = createPrismaClient(url ?? "");
    users = createPrismaUserDirectory(prisma, { demoExamples: DEMO_EXAMPLES, now: () => clock });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
    clock = new Date(Date.UTC(2026, 9, 21, 8, 0, 0));
  });

  it("crée l'utilisateur à sa première requête puis renvoie toujours le même id", async () => {
    const first = await users.resolve(alice);
    const second = await users.resolve(alice);

    expect(second).toBe(first);
    expect(await prisma.user.count()).toBe(1);
  });

  it("ne crée qu'une ligne pour des premières requêtes simultanées", async () => {
    const ids = await Promise.all([users.resolve(alice), users.resolve(alice)]);

    expect(ids[1]).toBe(ids[0]);
    expect(await prisma.user.count()).toBe(1);
  });

  it("met à jour l'email et le nom sans changer d'id", async () => {
    const id = await users.resolve(alice);

    await users.resolve({ ...alice, email: "alice@nouveau.test", name: undefined });

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ email: "alice@nouveau.test", name: null });
  });

  it("distingue deux comptes Firebase qui partagent un email", async () => {
    const google = await users.resolve(alice);
    const password = await users.resolve({ ...alice, uid: "uid-alice-mdp" });

    expect(password).not.toBe(google);
  });

  describe("sessions de démo", () => {
    it("E1 : crée la session avec les workflows d'exemple", async () => {
      const id = await users.resolve(visitor);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id },
        include: { workflows: true },
      });
      expect(user).toMatchObject({ isAnonymous: true, email: null });
      expect(user.workflows.map((workflow) => workflow.name).sort()).toEqual(
        DEMO_EXAMPLES.map((example) => example.name).sort(),
      );
    });

    it("E1 : des premières requêtes simultanées ne créent les exemples qu'une fois", async () => {
      await Promise.all([users.resolve(visitor), users.resolve(visitor), users.resolve(visitor)]);

      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.workflow.count()).toBe(DEMO_EXAMPLES.length);
    });

    it("E2 : ne recrée pas un exemple supprimé", async () => {
      const id = await users.resolve(visitor);
      await prisma.workflow.deleteMany({ where: { userId: id } });

      clock = new Date(clock.getTime() + 2 * LAST_SEEN_PRECISION_MS);
      await users.resolve(visitor);

      expect(await prisma.workflow.count()).toBe(0);
    });

    it("ne crée pas d'exemples pour un compte vérifié", async () => {
      await users.resolve(alice);

      expect(await prisma.workflow.count()).toBe(0);
    });

    it("U1 : le passage à un vrai compte garde le même utilisateur et ses workflows", async () => {
      const id = await users.resolve(visitor);

      const upgraded = await users.resolve({
        ...visitor,
        email: "visiteur@example.com",
        emailVerified: true,
        name: "Visiteur",
        anonymous: false,
      });

      expect(upgraded).toBe(id);
      const user = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(user).toMatchObject({ isAnonymous: false, email: "visiteur@example.com" });
      expect(await prisma.workflow.count({ where: { userId: id } })).toBe(DEMO_EXAMPLES.length);
    });

    it("N4 : met à jour lastSeenAt au plus une fois par heure", async () => {
      const id = await users.resolve(visitor);
      const created = (await prisma.user.findUniqueOrThrow({ where: { id } })).lastSeenAt;

      clock = new Date(clock.getTime() + LAST_SEEN_PRECISION_MS - 1000);
      await users.resolve(visitor);
      expect((await prisma.user.findUniqueOrThrow({ where: { id } })).lastSeenAt).toEqual(created);

      clock = new Date(clock.getTime() + 2000);
      await users.resolve(visitor);
      expect((await prisma.user.findUniqueOrThrow({ where: { id } })).lastSeenAt).toEqual(clock);
    });
  });
});
