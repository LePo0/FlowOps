import { describe, it, expect } from "vitest";
import { sampleWorkflow, type ConditionNode, type WorkflowGraph } from "@flowops/shared";
import { executeWorkflow } from "./execute-workflow.js";
import type { ExecutionResult, NodeResult } from "./types.js";

function jsonFetch(status: number, body: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

function statuses(nodeResults: NodeResult[]): Record<string, string> {
  return Object.fromEntries(nodeResults.map((result) => [result.nodeId, result.status]));
}

async function run(
  fetchImpl: typeof fetch,
): Promise<Exclude<ExecutionResult, { status: "INVALID" }>> {
  const result = await executeWorkflow(sampleWorkflow, { fetch: fetchImpl });
  if (result.status === "INVALID") throw new Error("Graphe d'exemple invalide");
  return result;
}

describe("executeWorkflow", () => {
  it("exécute le scénario nominal de bout en bout", async () => {
    const result = await run(
      jsonFetch(200, {
        products: [
          { id: 1, title: "A", price: 10 },
          { id: 2, title: "B", price: 20 },
        ],
      }),
    );

    expect(result.status).toBe("SUCCESS");
    expect(statuses(result.nodeResults)).toEqual({
      trigger: "SUCCESS",
      http1: "SUCCESS",
      check: "SUCCESS",
      names: "SUCCESS",
    });
    expect(result.nodeResults.find((r) => r.nodeId === "names")?.output).toEqual([
      { title: "A" },
      { title: "B" },
    ]);
  });

  it("ne traite pas un 404 comme une erreur du moteur : la branche non sélectionnée est ignorée", async () => {
    const result = await run(jsonFetch(404, { message: "Not found" }));

    expect(result.status).toBe("SUCCESS");
    expect(statuses(result.nodeResults)).toEqual({
      trigger: "SUCCESS",
      http1: "SUCCESS",
      check: "SUCCESS",
      names: "SKIPPED",
    });
  });

  it("marque le nœud HTTP en échec sur une erreur réseau et ignore la suite", async () => {
    const failingFetch: typeof fetch = async () => {
      // Même forme que fetch (undici) : la raison réelle est dans `cause`
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      });
    };
    const result = await run(failingFetch);

    expect(result.status).toBe("FAILED");
    expect(statuses(result.nodeResults)).toEqual({
      trigger: "SUCCESS",
      http1: "FAILED",
      check: "SKIPPED",
      names: "SKIPPED",
    });
    expect(result.nodeResults.find((r) => r.nodeId === "http1")?.error).toBe(
      "Connexion refusée par le serveur (ECONNREFUSED)",
    );
  });

  it("marque le nœud HTTP en échec quand le délai est dépassé", async () => {
    const graph = structuredClone(sampleWorkflow);
    const http = graph.nodes.find((node) => node.type === "http");
    if (http?.type === "http") http.config.timeoutMs = 100;
    // Ne répond jamais, mais s'arrête quand le moteur annule la requête
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    const result = await executeWorkflow(graph, { fetch: hangingFetch });

    expect(result.status).toBe("FAILED");
    if (result.status === "INVALID") return;
    expect(result.nodeResults.find((r) => r.nodeId === "http1")?.error).toBe(
      "Délai dépassé (100 ms)",
    );
  });

  it("rejette un graphe invalide sans rien exécuter", async () => {
    const graph = structuredClone(sampleWorkflow);
    graph.edges.push({ id: "e4", source: "names", target: "http1" });

    const result = await executeWorkflow(graph, { fetch: jsonFetch(200, {}) });
    expect(result.status).toBe("INVALID");
  });
});

const position = { x: 0, y: 0 };

/**
 * trigger → http1 → check ─true→ ok ──→ merge
 *                         └false→ ko ─┬→ merge
 *                                     └→ afterKo
 * `merge` lit `mergeSource` (http1.body par défaut).
 */
function branchingGraph(check: ConditionNode["config"], mergeSource = "http1.body"): WorkflowGraph {
  return {
    nodes: [
      { id: "trigger", type: "trigger", name: "Départ", position, config: {} },
      {
        id: "http1",
        type: "http",
        name: "Appel",
        position,
        config: { method: "GET", url: "https://api.exemple.test/" },
      },
      { id: "check", type: "condition", name: "Test", position, config: check },
      { id: "ok", type: "transform", name: "Si vrai", position, config: { source: "http1.body" } },
      {
        id: "ko",
        type: "transform",
        name: "Si faux",
        position,
        config: { source: "http1.status" },
      },
      { id: "afterKo", type: "transform", name: "Après faux", position, config: { source: "ko" } },
      { id: "merge", type: "transform", name: "Fusion", position, config: { source: mergeSource } },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "http1" },
      { id: "e2", source: "http1", target: "check" },
      { id: "e3", source: "check", target: "ok", branch: "true" },
      { id: "e4", source: "check", target: "ko", branch: "false" },
      { id: "e5", source: "ok", target: "merge" },
      { id: "e6", source: "ko", target: "merge" },
      { id: "e7", source: "ko", target: "afterKo" },
    ],
  };
}

async function runGraph(graph: WorkflowGraph, fetchImpl: typeof fetch, maxDurationMs?: number) {
  const result = await executeWorkflow(graph, { fetch: fetchImpl, maxDurationMs });
  if (result.status === "INVALID") {
    throw new Error(`Graphe invalide : ${result.errors.map((e) => e.message).join(" ; ")}`);
  }
  const byId = (nodeId: string) => result.nodeResults.find((r) => r.nodeId === nodeId);
  return { ...result, byId };
}

describe("executeWorkflow : cas limites", () => {
  it("exécute un nœud de fusion quelle que soit la branche prise, et ignore la branche écartée", async () => {
    const graph = branchingGraph({ left: "http1.status", operator: "eq", right: 200 });

    const success = await runGraph(graph, jsonFetch(200, { id: 1 }));
    expect(statuses(success.nodeResults)).toMatchObject({
      ok: "SUCCESS",
      ko: "SKIPPED",
      afterKo: "SKIPPED",
      merge: "SUCCESS",
    });

    const failure = await runGraph(graph, jsonFetch(500, { id: 1 }));
    expect(statuses(failure.nodeResults)).toMatchObject({
      ok: "SKIPPED",
      ko: "SUCCESS",
      afterKo: "SUCCESS",
      merge: "SUCCESS",
    });
    expect(failure.byId("afterKo")?.output).toBe(500);
  });

  it("fait échouer un nœud qui lit la sortie d'un nœud ignoré, avec un message explicite", async () => {
    const graph = branchingGraph({ left: "http1.status", operator: "eq", right: 200 }, "ko");

    const result = await runGraph(graph, jsonFetch(200, {}));

    expect(result.status).toBe("FAILED");
    expect(result.byId("merge")).toMatchObject({
      status: "FAILED",
      error: "Référence inconnue ou nœud non exécuté : ko",
    });
  });

  it("fait échouer la condition gt sur un texte, en montrant la valeur testée", async () => {
    const graph = branchingGraph({ left: "http1.body.count", operator: "gt", right: 10 });

    const result = await runGraph(graph, jsonFetch(200, { count: "42" }));

    expect(result.status).toBe("FAILED");
    expect(result.byId("check")).toMatchObject({
      status: "FAILED",
      error: "L'opérateur gt nécessite deux nombres",
      input: { value: "42" },
    });
    expect(statuses(result.nodeResults)).toMatchObject({
      ok: "SKIPPED",
      ko: "SKIPPED",
      merge: "SKIPPED",
    });
  });

  it("prend la branche false de exists pour un champ absent, et montre null comme valeur testée", async () => {
    const graph = branchingGraph({ left: "http1.body.next", operator: "exists" });

    const result = await runGraph(graph, jsonFetch(200, { results: [] }));

    expect(result.status).toBe("SUCCESS");
    expect(result.byId("check")).toMatchObject({
      status: "SUCCESS",
      input: { value: null },
      output: { result: false },
    });
    expect(result.byId("ko")?.status).toBe("SUCCESS");
  });

  it("laisse passer à la validation une référence vers un nœud inexistant, qui échoue à l'exécution", async () => {
    const graph = branchingGraph({ left: "inconnu.status", operator: "eq", right: 200 });

    const result = await runGraph(graph, jsonFetch(200, {}));

    expect(result.byId("check")).toMatchObject({
      status: "FAILED",
      error: "Référence inconnue ou nœud non exécuté : inconnu.status",
    });
  });

  it("fait échouer le nœud HTTP sur une réponse annoncée en JSON mais mal formée", async () => {
    const brokenJson: typeof fetch = async () =>
      new Response('{"products": [', { headers: { "content-type": "application/json" } });

    const result = await runGraph(
      branchingGraph({ left: "http1.status", operator: "eq", right: 200 }),
      brokenJson,
    );

    expect(result.byId("http1")).toMatchObject({
      status: "FAILED",
      error: "Réponse JSON invalide",
      input: { method: "GET", url: "https://api.exemple.test/" },
    });
    expect(result.byId("http1")?.errorDetail).toMatch(/^SyntaxError: /);
  });

  it("garde le corps en texte quand la réponse n'est pas du JSON", async () => {
    const html: typeof fetch = async () =>
      new Response("<h1>Bonjour</h1>", { headers: { "content-type": "text/html" } });

    const result = await runGraph(
      branchingGraph({ left: "http1.body", operator: "contains", right: "Bonjour" }),
      html,
    );

    expect(result.byId("http1")?.output).toEqual({
      status: 200,
      ok: true,
      body: "<h1>Bonjour</h1>",
    });
    expect(result.byId("ok")?.status).toBe("SUCCESS");
  });

  it("fait échouer le nœud suivant quand l'échéance est atteinte entre deux nœuds", async () => {
    // Répond après l'échéance sans écouter le signal, avec un corps vide : le nœud HTTP réussit
    const lateFetch: typeof fetch = () =>
      new Promise((resolve) => setTimeout(() => resolve(new Response(null, { status: 204 })), 50));

    const result = await runGraph(
      branchingGraph({ left: "http1.status", operator: "eq", right: 204 }),
      lateFetch,
      10,
    );

    expect(result.status).toBe("FAILED");
    expect(result.byId("http1")?.status).toBe("SUCCESS");
    expect(result.byId("check")).toMatchObject({
      status: "FAILED",
      error: "Durée maximale de l'exécution dépassée (10 ms)",
    });
    expect(statuses(result.nodeResults)).toMatchObject({
      ok: "SKIPPED",
      ko: "SKIPPED",
      merge: "SKIPPED",
    });
  });
});
