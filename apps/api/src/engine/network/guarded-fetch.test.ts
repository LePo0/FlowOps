import { describe, expect, it, vi } from "vitest";
import {
  createGuardedFetch,
  TargetDeniedError,
  type Resolve,
  type Transport,
} from "./guarded-fetch.js";
import { createNetworkPolicy, type NetworkPolicy } from "./policy.js";

// Scénarios de docs/security/http-node.md (identifiants entre crochets).
// DNS et transport sont simulés : aucun appel réseau, et on voit chaque connexion tentée.

const PUBLIC_IP = "93.184.216.34";
const OTHER_PUBLIC_IP = "151.101.1.1";

// Table DNS de test ; un nom absent n'existe pas
function fakeDns(table: Record<string, string[]>) {
  return vi.fn<Resolve>(async (hostname) => {
    const addresses = table[hostname];
    if (!addresses)
      throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return addresses;
  });
}

// Transport qui enregistre les connexions et répond selon l'URL (200 vide par défaut)
function recordingTransport(responses: Record<string, () => Response> = {}) {
  return vi.fn<Transport>(async (url) => responses[url.href]?.() ?? new Response("ok"));
}

const redirect =
  (location: string, status = 302) =>
  () =>
    new Response(null, { status, headers: { location } });

function guarded({
  dns = fakeDns({ "api.exemple.test": [PUBLIC_IP], "autre.exemple.test": [OTHER_PUBLIC_IP] }),
  transport = recordingTransport(),
  policy = createNetworkPolicy(),
}: {
  dns?: ReturnType<typeof fakeDns>;
  transport?: ReturnType<typeof recordingTransport>;
  policy?: NetworkPolicy;
} = {}) {
  return { fetch: createGuardedFetch({ policy, resolve: dns, transport }), dns, transport };
}

describe("fetch gardé : cibles", () => {
  it("[C1] laisse passer une URL publique et se connecte à l'adresse vérifiée", async () => {
    const { fetch, transport } = guarded();

    const response = await fetch("https://api.exemple.test/v1?x=1", { method: "GET" });

    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledOnce();
    const [url, , address] = transport.mock.calls[0]!;
    expect(url.href).toBe("https://api.exemple.test/v1?x=1");
    expect(address).toBe(PUBLIC_IP);
  });

  it.each([
    "http://localhost/",
    "http://127.0.0.1:3000/api/workflows",
    "http://[::1]/",
    "http://169.254.169.254/computeMetadata/v1/",
    "http://metadata.google.internal/",
    "http://10.0.0.5/",
    "http://192.168.1.1/admin",
  ])("[C2][C3][C4] refuse %s sans aucune connexion", async (target) => {
    const { fetch, transport } = guarded({
      dns: fakeDns({ localhost: ["127.0.0.1"], "metadata.google.internal": ["169.254.169.254"] }),
    });

    await expect(fetch(target)).rejects.toBeInstanceOf(TargetDeniedError);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "http://2130706433/", // 127.0.0.1 en entier
    "http://0x7f.1/", // 127.0.0.1 en hexadécimal abrégé
    "http://0177.0.0.1/", // 127.0.0.1 en octal
    "http://127.1/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/", // 169.254.169.254
  ])("[C7] refuse l'adresse interdite écrite autrement : %s", async (target) => {
    const { fetch, transport } = guarded();

    await expect(fetch(target)).rejects.toBeInstanceOf(TargetDeniedError);
    expect(transport).not.toHaveBeenCalled();
  });

  it("[C8] refuse un nom public qui résout vers une adresse interne", async () => {
    const { fetch, transport } = guarded({ dns: fakeDns({ "piege.exemple.test": ["127.0.0.1"] }) });

    await expect(fetch("https://piege.exemple.test/")).rejects.toBeInstanceOf(TargetDeniedError);
    expect(transport).not.toHaveBeenCalled();
  });

  it("[C9] refuse un nom dont une seule des adresses est interdite", async () => {
    const { fetch, transport } = guarded({
      dns: fakeDns({ "mixte.exemple.test": [PUBLIC_IP, "10.0.0.5"] }),
    });

    await expect(fetch("https://mixte.exemple.test/")).rejects.toBeInstanceOf(TargetDeniedError);
    expect(transport).not.toHaveBeenCalled();
  });

  it("[C10] résout une seule fois et se connecte à l'adresse vérifiée", async () => {
    // Première réponse publique, puis interne : une seconde résolution serait dangereuse
    const dns = vi
      .fn<Resolve>()
      .mockResolvedValueOnce([PUBLIC_IP])
      .mockResolvedValue(["127.0.0.1"]);
    const { fetch, transport } = guarded({ dns });

    await fetch("https://changeant.exemple.test/");

    expect(dns).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]![2]).toBe(PUBLIC_IP);
  });

  it.each([
    "file:///etc/passwd",
    "ftp://api.exemple.test/",
    "data:text/plain,bonjour",
    "ws://api.exemple.test/",
  ])("[C11] refuse le schéma de %s", async (target) => {
    const { fetch, transport } = guarded();

    await expect(fetch(target)).rejects.toBeInstanceOf(TargetDeniedError);
    expect(transport).not.toHaveBeenCalled();
  });

  it("[C6] en mode entreprise, joint un domaine interne listé", async () => {
    const { fetch, transport } = guarded({
      dns: fakeDns({ "api.interne.test": ["10.20.1.5"] }),
      policy: createNetworkPolicy({ allowed: "*.interne.test" }),
    });

    expect((await fetch("http://api.interne.test/stock")).status).toBe(200);
    expect(transport.mock.calls[0]![2]).toBe("10.20.1.5");
  });

  it("[I1] donne le même message, que la cible interdite existe ou non", async () => {
    const { fetch } = guarded({ dns: fakeDns({ "existe.exemple.test": ["10.0.0.5"] }) });

    const existing = await fetch("http://existe.exemple.test/").catch((error: Error) => error);
    const literal = await fetch("http://10.9.9.9:22/").catch((error: Error) => error);

    expect(existing).toBeInstanceOf(TargetDeniedError);
    expect(literal).toBeInstanceOf(TargetDeniedError);
    expect((existing as Error).message).toBe("Adresse non autorisée");
    expect((literal as Error).message).toBe((existing as Error).message);
  });
});

describe("fetch gardé : redirections", () => {
  it("[R1] suit une redirection autorisée et expose l'URL finale", async () => {
    const transport = recordingTransport({
      "https://api.exemple.test/a": redirect("/b"),
      "https://api.exemple.test/b": () => new Response("fin"),
    });
    const { fetch } = guarded({ transport });

    const response = await fetch("https://api.exemple.test/a");

    expect(await response.text()).toBe("fin");
    expect(response.url).toBe("https://api.exemple.test/b");
    expect(transport.mock.calls.map(([url]) => url.href)).toEqual([
      "https://api.exemple.test/a",
      "https://api.exemple.test/b",
    ]);
    // Le transport ne suit rien lui-même : FlowOps vérifie chaque étape
    expect(transport.mock.calls[0]![1].redirect).toBe("manual");
  });

  it.each(["http://127.0.0.1/", "http://169.254.169.254/computeMetadata/v1/", "http://10.0.0.5/"])(
    "[R2] refuse une redirection vers %s sans s'y connecter",
    async (location) => {
      const transport = recordingTransport({ "https://api.exemple.test/r": redirect(location) });
      const { fetch } = guarded({ transport });

      await expect(fetch("https://api.exemple.test/r")).rejects.toBeInstanceOf(TargetDeniedError);
      expect(transport).toHaveBeenCalledOnce();
    },
  );

  it("[R3] abandonne après 5 redirections", async () => {
    const responses = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `https://api.exemple.test/${i}`,
        redirect(`/${i + 1}`),
      ]),
    );
    const transport = recordingTransport(responses);
    const { fetch } = guarded({ transport });

    await expect(fetch("https://api.exemple.test/0")).rejects.toThrow("Trop de redirections");
    expect(transport).toHaveBeenCalledTimes(6);
  });

  it("[R4] retire les en-têtes sensibles quand la redirection change de domaine", async () => {
    const transport = recordingTransport({
      "https://api.exemple.test/a": redirect("/b"),
      "https://api.exemple.test/b": redirect("https://autre.exemple.test/c"),
    });
    const { fetch } = guarded({ transport });

    await fetch("https://api.exemple.test/a", {
      headers: {
        Authorization: "Bearer secret",
        Cookie: "s=1",
        "X-Api-Key": "k",
        Accept: "application/json",
      },
    });

    const headersOf = (call: number) => new Headers(transport.mock.calls[call]![1].headers);
    // Même domaine : en-têtes conservés
    expect(headersOf(1).get("authorization")).toBe("Bearer secret");
    // Autre domaine : seuls les en-têtes non sensibles suivent
    expect(headersOf(2).has("authorization")).toBe(false);
    expect(headersOf(2).has("cookie")).toBe(false);
    expect(headersOf(2).has("x-api-key")).toBe(false);
    expect(headersOf(2).get("accept")).toBe("application/json");
  });

  it("[R5] suit un 303 en GET, sans le corps du POST", async () => {
    const transport = recordingTransport({
      "https://api.exemple.test/commande": redirect("/commande/42", 303),
    });
    const { fetch } = guarded({ transport });

    await fetch("https://api.exemple.test/commande", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"article":1}',
    });

    const [, init] = transport.mock.calls[1]!;
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  it("[R1] renvoie la réponse 3xx telle quelle si elle n'indique pas de destination", async () => {
    const transport = recordingTransport({
      "https://api.exemple.test/cache": () => new Response(null, { status: 304 }),
    });
    const { fetch } = guarded({ transport });

    expect((await fetch("https://api.exemple.test/cache")).status).toBe(304);
  });
});
