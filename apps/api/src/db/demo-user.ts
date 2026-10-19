import type { PrismaClient } from "../generated/prisma/client.js";

export const DEMO_USER_EMAIL = "demo@flowops.local";

/**
 * Utilisateur unique en attendant l'authentification (roadmap, étape 4).
 * Créé au démarrage s'il n'existe pas ; ses workflows seront rattachés au vrai compte ensuite.
 */
export async function ensureDemoUser(prisma: PrismaClient): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Utilisateur de démonstration" },
  });
  return user.id;
}
