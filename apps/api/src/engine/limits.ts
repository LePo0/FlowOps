// Limites d'exécution du nœud HTTP et du moteur (docs/security/http-node.md, scénarios L)

export const DEFAULT_TIMEOUT_MS = 10_000;

// Taille maximale d'une réponse, comptée sur les octets décompressés
export const MAX_RESPONSE_BYTES = 1_000_000;

// Sans échéance, 50 nœuds HTTP à 30 s chacun occuperaient le serveur 25 minutes
export const DEFAULT_MAX_DURATION_MS = 60_000;

export const deadlineMessage = (maxDurationMs: number) =>
  `Durée maximale de l'exécution dépassée (${maxDurationMs} ms)`;
