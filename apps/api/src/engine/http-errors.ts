// Traduit une erreur levée par fetch en message compréhensible pour l'utilisateur.
// fetch (undici) lève un TypeError générique "fetch failed" : la vraie raison est dans `cause`.
//
// Ces messages distinguent « refusé », « introuvable » et « délai dépassé » : utile en local,
// mais c'est aussi un oracle pour sonder un réseau interne. À revoir avec la protection SSRF
// (roadmap, étape « Sécurité du nœud HTTP ») avant toute mise en ligne.

const CERTIFICATE_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

const CODE_MESSAGES: Partial<Record<string, string>> = {
  ENOTFOUND: "Nom de domaine introuvable",
  EAI_AGAIN: "Résolution DNS impossible pour le moment",
  ECONNREFUSED: "Connexion refusée par le serveur",
  ECONNRESET: "Connexion interrompue par le serveur",
  ETIMEDOUT: "Le serveur ne répond pas",
  UND_ERR_CONNECT_TIMEOUT: "Le serveur ne répond pas",
};

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export function describeFetchError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return `Délai dépassé (${timeoutMs} ms)`;
  }
  if (!(error instanceof Error)) return "Échec de la requête";

  const cause = error.cause;
  const code = errorCode(cause);

  if (code !== undefined && CERTIFICATE_CODES.has(code)) {
    return `Certificat TLS non reconnu (${code})`;
  }
  const known = code !== undefined ? CODE_MESSAGES[code] : undefined;
  if (known !== undefined) return `${known} (${code})`;

  // URL mal formée : fetch lève "Failed to parse URL from …"
  if (cause instanceof Error && cause.message === "Invalid URL") return "URL invalide";
  // fetch refuse par principe certains ports réservés (25, 6000, …)
  if (cause instanceof Error && cause.message === "bad port") {
    return "Port interdit par fetch (port réservé à un autre protocole)";
  }

  const detail = cause instanceof Error ? cause.message : error.message;
  return code !== undefined
    ? `Échec de la requête : ${detail} (${code})`
    : `Échec de la requête : ${detail}`;
}
