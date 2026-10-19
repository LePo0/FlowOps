import type { PrismaClient } from "../generated/prisma/client.js";
import type { UserDirectory } from "./identity.js";

export function createPrismaUserDirectory(prisma: PrismaClient): UserDirectory {
  return {
    resolve: async ({ uid, email, name }) => {
      // Lecture d'abord : pas d'écriture à chaque requête, seulement si le profil a changé
      const existing = await prisma.user.findUnique({ where: { authUid: uid } });
      if (existing && existing.email === email && existing.name === (name ?? null)) {
        return existing.id;
      }
      // upsert : deux premières requêtes simultanées du même compte ne créent qu'une ligne
      const user = await prisma.user.upsert({
        where: { authUid: uid },
        update: { email, name: name ?? null },
        create: { authUid: uid, email, name: name ?? null },
      });
      return user.id;
    },
  };
}
