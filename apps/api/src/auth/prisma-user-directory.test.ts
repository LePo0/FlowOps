import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "../db/client.js";
import type { UserDirectory } from "./identity.js";
import { createPrismaUserDirectory } from "./prisma-user-directory.js";

// Test d'intégration sur une vraie base PostgreSQL (TEST_DATABASE_URL), ignoré sans elle
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("annuaire Prisma des utilisateurs (base de test)", () => {
  let prisma: PrismaClient;
  let users: UserDirectory;
  const alice = { uid: "uid-alice", email: "alice@test.local", emailVerified: true, name: "Alice" };

  beforeAll(() => {
    prisma = createPrismaClient(url ?? "");
    users = createPrismaUserDirectory(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
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
});
