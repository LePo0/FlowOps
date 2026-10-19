/**
 * Scénarios de sécurité du nœud HTTP, vus depuis le moteur.
 * Référence : docs/security/http-node.md (L1–L6, C12, I1–I3).
 *
 * Attendu avant l'étape 5 : la plupart des tests échouent (lecture non bornée,
 * pas d'échéance globale). I3 passe déjà (masquage existant).
 */
import { describe, it, expect, vi } from "vitest";
import type { WorkflowGraph, WorkflowNode } from "@flowops/shared";
import { executeWorkflow } from "./execute-workflow.js";
import { createGuardedFetch, type Resolve, type Transport } from "./network/guarded-fetch.js";
import { createNetworkPolicy } from "./network/policy.js";
import type { ExecutionDeps, NodeResult } from "./types.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ONE_MB = 1024 * 1024;
const REFUSED = "Adresse non autorisée";
const PUBLIC_IP = "93.184.216.34";

// ---------------------------------------------------------------------------
// Construction des graphes (forme de WorkflowNode : packages/shared/src/workflow.ts)
// ---------------------------------------------------------------------------

function trigger(id = "start"): WorkflowNode {
  return { id, type: "trigger", name: "Départ", position: { x: 0, y: 0 }, config: {} };
}

interface HttpOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function http(id: string, url: string, opts: HttpOptions = {}): WorkflowNode {
  return {
    id,
    type: "http",
    name: id,
    position: { x: 0, y: 0 },
    config: {
      method: opts.method ?? "GET",
      url,
      ...(opts.headers !== undefined && { headers: opts.headers }),
      ...(opts.timeoutMs !== undefined && { timeoutMs: opts.timeoutMs }),
    },
  };
}

/** Chaîne linéaire : déclencheur → nœuds dans l'ordre donné. */
function chain(...httpNodes: WorkflowNode[]): WorkflowGraph {
  const nodes = [trigger(), ...httpNodes];
  const edges = nodes.slice(1).map((node, i) => ({
    id: `e${i}`,
    source: nodes[i]!.id,
    target: node.id,
  }));
  return { nodes, edges };
}

/** Exécute le graphe et renvoie un accès au résultat de chaque nœud. */
async function run(graph: WorkflowGraph, deps: ExecutionDeps) {
  const result = await executeWorkflow(graph, deps);
  // Un graphe refusé n'exécute rien : le test échouerait pour une mauvaise raison
  if (result.status === "INVALID") {
    throw new Error(`Graphe invalide : ${result.errors.map((e) => e.message).join(" ; ")}`);
  }
  return (nodeId: string): NodeResult | undefined =>
    result.nodeResults.find((r) => r.nodeId === nodeId);
}

// ---------------------------------------------------------------------------
// Réponses simulées
// ---------------------------------------------------------------------------

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/**
 * Corps en flux de `totalBytes`, servi par morceaux à la demande
 * (highWaterMark 0 : rien n'est produit tant que personne ne lit).
 * Permet de vérifier combien d'octets le moteur a réellement consommés
 * et s'il a fermé le flux.
 */
function trackedBody(totalBytes: number, chunkSize = 64 * 1024) {
  const state = { served: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.served >= totalBytes) {
          controller.close();
          return;
        }
        const n = Math.min(chunkSize, totalBytes - state.served);
        state.served += n;
        controller.enqueue(new Uint8Array(n).fill(0x61)); // 'a'
      },
      cancel() {
        state.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, state };
}

/** fetch simulé qui répond toujours la même chose. */
function fetchReturning(makeResponse: () => Response) {
  return vi.fn<typeof fetch>(async () => makeResponse());
}

// ---------------------------------------------------------------------------
// Garde réseau avec DNS et transport simulés (C12, I1, I2)
// ---------------------------------------------------------------------------

const DNS: Record<string, string[]> = {
  "api.public.test": [PUBLIC_IP],
  "metadata.google.internal": ["169.254.169.254"],
  "intranet.test": ["10.0.0.5"],
};

function makeGuardedFetch() {
  const resolve = vi.fn<Resolve>(async (hostname) => {
    const addresses = DNS[hostname];
    if (!addresses) throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return addresses;
  });

  // Le transport reçoit l'adresse IP déjà vérifiée. Seule l'API publique répond.
  const transport = vi.fn<Transport>(async (url, _init, address) => {
    if (address === PUBLIC_IP && url.pathname === "/next") {
      return json({ next: "http://169.254.169.254/latest/meta-data/" });
    }
    if (address === PUBLIC_IP) return json({ ok: true });
    // Une cible interne joignable : ne doit jamais être atteinte.
    if (address === "10.0.0.5") return json({ secret: "interne" });
    throw Object.assign(new Error(`connect ECONNREFUSED ${address}:${url.port || 80}`), {
      code: "ECONNREFUSED",
    });
  });

  // Mode par défaut (SaaS) : aucune liste.
  const policy = createNetworkPolicy();
  const guardedFetch = createGuardedFetch({ policy, resolve, transport });

  return { guardedFetch, resolve, transport };
}

// ===========================================================================
// Ressources
// ===========================================================================

describe("Nœud HTTP — ressources", () => {
  it("L1 : réponse de plus de 1 Mo → lecture interrompue à 1 Mo, flux fermé, nœud en échec", async () => {
    const body = trackedBody(4 * ONE_MB);
    const fetchMock = fetchReturning(
      () =>
        new Response(body.stream, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await run(chain(http("a", "https://api.public.test/big")), {
      fetch: fetchMock,
    });

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toMatch(/volumineuse/i);
    // On tolère un morceau de dépassement, pas la lecture complète.
    expect(body.state.served).toBeLessThanOrEqual(ONE_MB + 64 * 1024);
    expect(body.state.cancelled).toBe(true);
  });

  it("L2 : Content-Length inférieur à la taille réelle → même coupure à 1 Mo", async () => {
    const body = trackedBody(4 * ONE_MB);
    const fetchMock = fetchReturning(
      () =>
        new Response(body.stream, {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "100" },
        }),
    );

    const result = await run(chain(http("a", "https://api.public.test/liar")), {
      fetch: fetchMock,
    });

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toMatch(/volumineuse/i);
    expect(body.state.served).toBeLessThanOrEqual(ONE_MB + 64 * 1024);
    expect(body.state.cancelled).toBe(true);
  });

  it("L3 : Content-Length supérieur à 1 Mo → refus sans lire le corps", async () => {
    const body = trackedBody(5 * ONE_MB);
    const fetchMock = fetchReturning(
      () =>
        new Response(body.stream, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": String(5 * ONE_MB),
          },
        }),
    );

    const result = await run(chain(http("a", "https://api.public.test/announced-big")), {
      fetch: fetchMock,
    });

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toMatch(/volumineuse/i);
    expect(body.state.served).toBe(0);
    expect(body.state.cancelled).toBe(true);
  });

  it("L4 : réponse compressée qui dépasse 1 Mo décompressée → coupure sur la taille décompressée", async () => {
    // fetch décompresse lui-même : le corps exposé est décompressé, mais
    // Content-Length annonce la taille compressée (petite).
    const body = trackedBody(4 * ONE_MB);
    const fetchMock = fetchReturning(
      () =>
        new Response(body.stream, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-encoding": "gzip",
            "content-length": String(10 * 1024),
          },
        }),
    );

    const result = await run(chain(http("a", "https://api.public.test/gzip-bomb")), {
      fetch: fetchMock,
    });

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toMatch(/volumineuse/i);
    expect(body.state.served).toBeLessThanOrEqual(ONE_MB + 64 * 1024);
  });

  it("L5 : corps envoyé au compte-gouttes → le délai du nœud couvre toute la lecture", async () => {
    // Les en-têtes arrivent tout de suite, puis le corps ne se termine jamais.
    // Comme le vrai fetch, le flux échoue quand le signal est annulé.
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"items":['));
          init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const startedAt = Date.now();
    const result = await run(chain(http("a", "https://api.public.test/slow", { timeoutMs: 200 })), {
      fetch: fetchMock,
    });
    const elapsed = Date.now() - startedAt;

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toMatch(/délai|timeout/i);
    expect(elapsed).toBeLessThan(1_000);
  }, 3_000); // sans borne sur la lecture, le test expire ici

  it("L6 : somme des délais au-delà de l'échéance globale → exécution arrêtée, nœuds restants non exécutés", async () => {
    // Chaque appel met 300 ms ; échéance globale à 500 ms.
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(json({ ok: true })), 300);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(init.signal?.reason);
          });
        }),
    );

    const startedAt = Date.now();
    const result = await run(
      chain(
        http("a", "https://api.public.test/1"),
        http("b", "https://api.public.test/2"),
        http("c", "https://api.public.test/3"),
      ),
      { fetch: fetchMock, maxDurationMs: 500 },
    );
    const elapsed = Date.now() - startedAt;

    expect(result("a")?.status).toBe("SUCCESS");

    const b = result("b");
    expect(b?.status).toBe("FAILED");
    expect(b?.error).toMatch(/durée maximale|échéance/i);

    // c n'est jamais appelé : absent des résultats ou marqué SKIPPED.
    expect(result("c")?.status ?? "SKIPPED").toBe("SKIPPED");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Arrêt à l'échéance, pas à la fin de b (600 ms).
    expect(elapsed).toBeLessThan(580);
  }, 3_000);
});

// ===========================================================================
// Cibles construites par référence
// ===========================================================================

describe("Nœud HTTP — cibles", () => {
  it("C12 : URL interdite obtenue via une {{référence}} → refus au moment de l'appel", async () => {
    const { guardedFetch, transport } = makeGuardedFetch();

    // a renvoie { next: 'http://169.254.169.254/...' }, b appelle cette URL.
    // La sortie d'un nœud HTTP est { status, ok, body } : la référence passe par body
    const result = await run(
      chain(http("a", "https://api.public.test/next"), http("b", "{{a.body.next}}")),
      { fetch: guardedFetch },
    );

    expect(result("a")?.status).toBe("SUCCESS");

    const b = result("b");
    expect(b?.status).toBe("FAILED");
    expect(b?.error).toBe(REFUSED);

    // Aucune connexion vers le serveur de métadonnées.
    const contacted = transport.mock.calls.map(([, , address]) => address);
    expect(contacted).not.toContain("169.254.169.254");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Informations divulguées
// ===========================================================================

describe("Nœud HTTP — informations divulguées", () => {
  it("I1 : cible refusée → même message, qu'elle existe ou non", async () => {
    const { guardedFetch, transport } = makeGuardedFetch();

    // Deux exécutions séparées : en chaîne, le second nœud serait SKIPPED après le premier échec
    const existing = (
      await run(chain(http("existing", "http://10.0.0.5:8080/")), { fetch: guardedFetch })
    )("existing"); // machine qui répondrait
    const missing = (
      await run(chain(http("missing", "http://10.0.0.6:1/")), { fetch: guardedFetch })
    )("missing"); // port fermé

    expect(existing?.status).toBe("FAILED");
    expect(missing?.status).toBe("FAILED");
    expect(existing?.error).toBe(REFUSED);
    expect(missing?.error).toBe(REFUSED);
    expect(existing?.errorDetail).toEqual(missing?.errorDetail);
    expect(transport).not.toHaveBeenCalled();
  });

  it("I2 : détail d’une cible refusée → ni adresse IP résolue, ni cause réseau", async () => {
    const { guardedFetch, transport } = makeGuardedFetch();

    const result = await run(chain(http("a", "http://intranet.test/admin")), {
      fetch: guardedFetch,
    });

    const a = result("a");
    expect(a?.status).toBe("FAILED");
    expect(a?.error).toBe(REFUSED);

    const serialized = JSON.stringify(a);
    expect(serialized).not.toContain("10.0.0.5");
    expect(serialized).not.toMatch(/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/);
    expect(transport).not.toHaveBeenCalled();
  });

  it("I3 : en-têtes sensibles masqués dans le détail d’exécution", async () => {
    const fetchMock = fetchReturning(() => json({ ok: true }));

    const result = await run(
      chain(
        http("a", "https://api.public.test/me", {
          headers: {
            Authorization: "Bearer super-secret-token",
            "X-Api-Key": "cle-tres-secrete",
            Accept: "application/json",
          },
        }),
      ),
      { fetch: fetchMock },
    );

    const a = result("a");
    expect(a?.status).toBe("SUCCESS");

    const serialized = JSON.stringify(a);
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("cle-tres-secrete");
    expect(serialized).toContain("***");
    // Les en-têtes ordinaires restent lisibles.
    expect(serialized).toContain("application/json");
  });
});
