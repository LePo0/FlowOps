import type { PrismaClient } from "../generated/prisma/client.js";

// Une session de démo sans requête depuis 7 jours est supprimée (scénario N1)
export const DEMO_SESSION_MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Supprime les sessions de démo inactives depuis `before` ; renvoie leur nombre
export type DeleteInactiveDemoSessions = (before: Date) => Promise<number>;

// Workflows et exécutions suivent par cascade. Un vrai compte n'est jamais touché (N2).
export const createPrismaDemoSessionCleaner =
  (prisma: PrismaClient): DeleteInactiveDemoSessions =>
  async (before) =>
    (await prisma.user.deleteMany({ where: { isAnonymous: true, lastSeenAt: { lt: before } } }))
      .count;

/**
 * Nettoyage au démarrage puis toutes les heures, dans le processus de l'API : pas de tâche
 * planifiée à déployer. Cloud Run peut s'arrêter sans trafic, mais sans trafic rien ne s'accumule.
 * Plusieurs instances peuvent nettoyer en même temps : la suppression est idempotente.
 * Les comptes anonymes Firebase restent : ils ne contiennent aucune donnée, et un visiteur qui
 * revient après la suppression repart d'une session neuve, avec les exemples.
 */
export function scheduleDemoSessionCleanup(
  deleteInactive: DeleteInactiveDemoSessions,
  {
    now = () => Date.now(),
    log = console,
  }: { now?: () => number; log?: Pick<Console, "info" | "error"> } = {},
): () => void {
  const run = async () => {
    try {
      const count = await deleteInactive(new Date(now() - DEMO_SESSION_MAX_IDLE_MS));
      if (count > 0) log.info(`Sessions de démo inactives supprimées : ${count}`);
    } catch (error) {
      // Une base momentanément injoignable ne doit pas arrêter l'API : nouvel essai dans 1 h
      log.error("Nettoyage des sessions de démo impossible", error);
    }
  };
  void run();
  const timer = setInterval(() => void run(), CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
