import { describe, it, expect } from "vitest";
import { describeFetchError } from "./http-errors.js";

// Reproduit la forme des erreurs de fetch (undici) : TypeError "fetch failed" + cause
function fetchFailed(cause: unknown): TypeError {
  return new TypeError("fetch failed", { cause });
}

function systemError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("describeFetchError", () => {
  it("signale un certificat non reconnu (proxy d'entreprise)", () => {
    const error = fetchFailed(
      systemError("SELF_SIGNED_CERT_IN_CHAIN", "self-signed certificate in certificate chain"),
    );

    expect(describeFetchError(error, 10_000)).toBe(
      "Certificat TLS non reconnu (SELF_SIGNED_CERT_IN_CHAIN)",
    );
  });

  it("traduit les erreurs réseau courantes", () => {
    expect(describeFetchError(fetchFailed(systemError("ENOTFOUND", "getaddrinfo")), 10_000)).toBe(
      "Nom de domaine introuvable (ENOTFOUND)",
    );
    expect(describeFetchError(fetchFailed(systemError("ECONNREFUSED", "connect")), 10_000)).toBe(
      "Connexion refusée par le serveur (ECONNREFUSED)",
    );
  });

  it("indique le délai dépassé", () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");

    expect(describeFetchError(timeout, 5_000)).toBe("Délai dépassé (5000 ms)");
  });

  it("reconnaît une URL mal formée", () => {
    const error = new TypeError("Failed to parse URL from pas-une-url", {
      cause: new TypeError("Invalid URL"),
    });

    expect(describeFetchError(error, 10_000)).toBe("URL invalide");
  });

  it("explique un port refusé par fetch", () => {
    expect(describeFetchError(fetchFailed(new Error("bad port")), 10_000)).toBe(
      "Port interdit par fetch (port réservé à un autre protocole)",
    );
  });

  it("garde le détail d'une cause inconnue", () => {
    expect(describeFetchError(fetchFailed(new Error("socket hang up")), 10_000)).toBe(
      "Échec de la requête : socket hang up",
    );
    expect(describeFetchError(fetchFailed(systemError("EPROTO", "wrong version")), 10_000)).toBe(
      "Échec de la requête : wrong version (EPROTO)",
    );
    expect(describeFetchError(new Error("ECONNREFUSED"), 10_000)).toBe(
      "Échec de la requête : ECONNREFUSED",
    );
  });
});
