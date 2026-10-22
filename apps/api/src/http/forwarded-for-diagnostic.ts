import type { RequestHandler } from "express";

// En-têtes qui peuvent porter l'adresse du visiteur derrière un relais (Hosting, CDN, répartiteur)
const ADDRESS_HEADER = /forwarded|client-ip|real-ip|^x-fah-/i;

/**
 * Diagnostic temporaire (LOG_FORWARDED_FOR=true) : journalise les en-têtes d'adresse reçus et
 * l'adresse retenue (req.ip), pour régler TRUST_PROXY_HOPS sur le vrai déploiement. Ces lignes
 * contiennent des adresses IP : à n'activer que le temps de la mesure (deploy/README.md).
 */
export const logForwardedFor: RequestHandler = (req, _res, next) => {
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([name]) => ADDRESS_HEADER.test(name)),
  );
  console.log(JSON.stringify({ diagnostic: "forwarded-for", ip: req.ip, ips: req.ips, headers }));
  next();
};
