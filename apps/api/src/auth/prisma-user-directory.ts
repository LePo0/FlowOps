import type { SaveWorkflowRequest } from "@flowops/shared";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { UserDirectory } from "./identity.js";

// lastSeenAt n'est réécrit qu'à cette précision : pas d'écriture à chaque requête
export const LAST_SEEN_PRECISION_MS = 60 * 60 * 1000;

export interface UserDirectoryOptions {
  // Workflows créés avec chaque nouvelle session de démo
  demoExamples?: SaveWorkflowRequest[];
  now?: () => Date;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export function createPrismaUserDirectory(
  prisma: PrismaClient,
  { demoExamples = [], now = () => new Date() }: UserDirectoryOptions = {},
): UserDirectory {
  return {
    resolve: async ({ uid, email, name, anonymous }) => {
      const profile = { email: email ?? null, name: name ?? null, isAnonymous: anonymous };
      const time = now();

      // Lecture d'abord : pas d'écriture tant que le profil ne change pas et que lastSeenAt
      // est à jour à l'heure près
      const existing = await prisma.user.findUnique({ where: { authUid: uid } });
      if (existing) {
        const unchanged =
          existing.email === profile.email &&
          existing.name === profile.name &&
          existing.isAnonymous === profile.isAnonymous;
        if (
          !unchanged ||
          time.getTime() - existing.lastSeenAt.getTime() >= LAST_SEEN_PRECISION_MS
        ) {
          // Passage d'une session de démo à un vrai compte : même uid, même User, mêmes workflows
          await prisma.user.update({
            where: { id: existing.id },
            data: { ...profile, lastSeenAt: time },
          });
        }
        return existing.id;
      }

      // Création avec les exemples dans la même écriture : ils n'existent qu'une fois (E1), et
      // ne sont jamais recréés ensuite, même si le visiteur les supprime (E2)
      const workflows = anonymous
        ? {
            create: demoExamples.map(({ name: workflowName, graph }) => ({
              name: workflowName,
              graphJson: graph as unknown as Prisma.InputJsonValue,
            })),
          }
        : undefined;
      try {
        const user = await prisma.user.create({
          data: { authUid: uid, ...profile, lastSeenAt: time, workflows },
        });
        return user.id;
      } catch (error) {
        // Deux premières requêtes simultanées : la seconde retrouve la ligne créée par la première
        if (!isUniqueViolation(error)) throw error;
        const user = await prisma.user.findUniqueOrThrow({ where: { authUid: uid } });
        return user.id;
      }
    },
  };
}
