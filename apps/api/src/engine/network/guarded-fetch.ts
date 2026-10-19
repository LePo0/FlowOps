import { isIP } from "node:net";
import type { NetworkPolicy } from "./policy.js";
import { SENSITIVE_HEADER } from "./sensitive-header.js";

// Résolution DNS : toutes les adresses d'un nom (injectée : les tests n'utilisent pas le réseau)
export type Resolve = (hostname: string) => Promise<string[]>;

// Envoie une requête HTTP en se connectant à `address`, sans nouvelle résolution du nom
export type Transport = (url: URL, init: RequestInit, address: string) => Promise<Response>;

// Cible refusée par la politique. Message volontairement unique : il ne dit rien de la cible
// (existe-t-elle, port ouvert ou fermé), et l'erreur ne porte ni adresse ni cause réseau.
export class TargetDeniedError extends Error {
  override name = "TargetDeniedError";
  constructor() {
    super("Adresse non autorisée");
  }
}

export interface GuardedFetchDeps {
  policy: NetworkPolicy;
  resolve: Resolve;
  transport: Transport;
}

export const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
// En-têtes qui décrivent le corps : retirés quand une redirection le supprime
const BODY_HEADERS = ["content-type", "content-length", "content-encoding", "content-language"];

// Même forme d'erreur que fetch (TypeError "fetch failed" + cause) : http-errors.ts la traduit
const fetchFailed = (cause: unknown) => new TypeError("fetch failed", { cause });

/**
 * fetch du nœud HTTP : chaque connexion, redirections comprises, respecte la politique réseau.
 * Le nom est résolu une seule fois par étape et la connexion se fait vers l'adresse vérifiée
 * (le transport ne refait pas de résolution DNS) : une réponse DNS qui change entre la
 * vérification et la connexion ne peut pas mener à une adresse interdite.
 */
export function createGuardedFetch({ policy, resolve, transport }: GuardedFetchDeps): typeof fetch {
  // Adresse vérifiée à laquelle se connecter, ou TargetDeniedError
  const vet = async (url: URL): Promise<string> => {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new TargetDeniedError();
    // L'URL est déjà normalisée : 2130706433 ou 0x7f.1 y sont devenus 127.0.0.1
    const host = url.hostname.replace(/^\[(.*)\]$/, "$1");

    let addresses: string[];
    if (isIP(host)) {
      addresses = [host];
    } else {
      try {
        addresses = await resolve(host);
      } catch (error) {
        throw fetchFailed(error);
      }
      if (addresses.length === 0) {
        throw fetchFailed(Object.assign(new Error(`ENOTFOUND ${host}`), { code: "ENOTFOUND" }));
      }
    }
    // Toutes les adresses doivent être autorisées, pas seulement celle qu'on utilisera
    if (addresses.some((address) => policy.decide(host, address) === "deny")) {
      throw new TargetDeniedError();
    }
    return addresses[0]!;
  };

  return async (input, init = {}) => {
    let url: URL;
    try {
      url = new URL(input instanceof Request ? input.url : String(input));
    } catch (error) {
      throw fetchFailed(error);
    }
    // Le transport ne suit rien lui-même : chaque étape repasse par vet()
    let request: RequestInit = { ...init, redirect: "manual" };

    for (let redirects = 0; ; redirects++) {
      const address = await vet(url);
      const response = await transport(url, request, address);
      const location = response.headers.get("location");

      if (!REDIRECT_STATUSES.has(response.status) || location === null) {
        // L'URL finale reste visible pour l'appelant, comme avec fetch
        Object.defineProperty(response, "url", { value: url.href });
        return response;
      }
      await response.body?.cancel();
      if (redirects === MAX_REDIRECTS) throw new Error("Trop de redirections");

      const next = new URL(location, url);
      request = followRedirect(request, response.status, url, next);
      url = next;
    }
  };
}

// Requête de l'étape suivante, selon les règles de fetch (WHATWG) pour la méthode et le corps
function followRedirect(request: RequestInit, status: number, from: URL, to: URL): RequestInit {
  const headers = new Headers(request.headers);
  const method = (request.method ?? "GET").toUpperCase();
  let next: RequestInit = { ...request, headers };

  const becomesGet =
    (status === 303 && method !== "GET" && method !== "HEAD") ||
    ((status === 301 || status === 302) && method === "POST");
  if (becomesGet) {
    next = { ...next, method: "GET", body: undefined };
    for (const name of BODY_HEADERS) headers.delete(name);
  }

  // Autre origine (domaine, schéma ou port) : la clé d'un service ne part pas chez un autre
  if (from.origin !== to.origin) {
    for (const name of [...headers.keys()]) {
      if (SENSITIVE_HEADER.test(name)) headers.delete(name);
    }
  }
  return next;
}
