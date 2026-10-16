import { describe, it, expect, vi } from "vitest";
import type { WorkflowGraph, WorkflowNode } from "@flowops/shared";
import { executeWorkflow } from "./execute-workflow.js";
import type { NodeResult } from "./types.js";

const POKEMON_LIST = {
  results: [{ name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" }],
};

// Répond selon l'URL appelée, sans réseau
function routedFetch(routes: Record<string, unknown>) {
  return vi.fn<typeof fetch>(async (input) => {
    const body = routes[String(input)];
    if (body === undefined) throw new TypeError("fetch failed");
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  });
}

const position = { x: 0, y: 0 };

// trigger → list (GET la liste) → detail (config donnée)
function chain(detail: Partial<Extract<WorkflowNode, { type: "http" }>["config"]>): WorkflowGraph {
  return {
    nodes: [
      { id: "trigger", type: "trigger", name: "Départ", position, config: {} },
      {
        id: "list",
        type: "http",
        name: "Liste",
        position,
        config: { method: "GET", url: "https://pokeapi.co/api/v2/pokemon/" },
      },
      {
        id: "detail",
        type: "http",
        name: "Détail",
        position,
        config: { method: "GET", url: "", ...detail },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "list" },
      { id: "e2", source: "list", target: "detail" },
    ],
  };
}

async function detailResult(graph: WorkflowGraph, fetchImpl: typeof fetch): Promise<NodeResult> {
  const result = await executeWorkflow(graph, { fetch: fetchImpl });
  if (result.status === "INVALID") throw new Error("graphe invalide");
  const detail = result.nodeResults.find((r) => r.nodeId === "detail");
  if (!detail) throw new Error("nœud detail absent");
  return detail;
}

describe("nœud HTTP : références et détail d'exécution", () => {
  it("appelle une URL extraite de la réponse précédente", async () => {
    const fetchMock = routedFetch({
      "https://pokeapi.co/api/v2/pokemon/": POKEMON_LIST,
      "https://pokeapi.co/api/v2/pokemon/1/": { name: "bulbasaur", height: 7 },
    });

    const detail = await detailResult(chain({ url: "{{list.body.results.0.url}}" }), fetchMock);

    expect(detail.status).toBe("SUCCESS");
    expect(detail.input).toMatchObject({
      method: "GET",
      url: "https://pokeapi.co/api/v2/pokemon/1/",
    });
    expect(detail.output).toMatchObject({ body: { name: "bulbasaur", height: 7 } });
  });

  it("résout les références dans les en-têtes et le corps, et masque les en-têtes sensibles", async () => {
    const fetchMock = routedFetch({
      "https://pokeapi.co/api/v2/pokemon/": POKEMON_LIST,
      "https://api.exemple.dev/favoris": { ok: true },
    });

    const detail = await detailResult(
      chain({
        method: "POST",
        url: "https://api.exemple.dev/favoris",
        headers: {
          Authorization: "Bearer secret-123",
          "X-Pokemon": "{{list.body.results.0.name}}",
        },
        body: '{"pokemon": "{{list.body.results.0.name}}"}',
      }),
      fetchMock,
    );

    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.headers).toEqual({ Authorization: "Bearer secret-123", "X-Pokemon": "bulbasaur" });
    expect(init?.body).toBe('{"pokemon": "bulbasaur"}');
    expect(detail.input).toEqual({
      method: "POST",
      url: "https://api.exemple.dev/favoris",
      headers: { Authorization: "***", "X-Pokemon": "bulbasaur" },
      body: '{"pokemon": "bulbasaur"}',
    });
  });

  it("échoue sans appeler le réseau si la référence est vide, en montrant l'URL saisie", async () => {
    const fetchMock = routedFetch({ "https://pokeapi.co/api/v2/pokemon/": POKEMON_LIST });

    const detail = await detailResult(chain({ url: "{{list.body.results.9.url}}" }), fetchMock);

    expect(detail.status).toBe("FAILED");
    expect(detail.error).toBe("La référence list.body.results.9.url est vide");
    expect(detail.input).toEqual({ method: "GET", url: "{{list.body.results.9.url}}" });
    expect(detail.errorDetail).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("montre l'URL appelée et suggère les accolades pour une référence mal écrite", async () => {
    // Vraie URL invalide : on laisse le vrai fetch la rejeter (aucun appel réseau n'a lieu)
    const listOnly = routedFetch({ "https://pokeapi.co/api/v2/pokemon/": POKEMON_LIST });
    const fetchImpl: typeof fetch = (input, init) =>
      String(input).startsWith("https://") ? listOnly(input, init) : fetch(input, init);

    const detail = await detailResult(chain({ url: "list.body.results.0.url" }), fetchImpl);

    expect(detail.status).toBe("FAILED");
    expect(detail.error).toBe(
      "URL invalide. Pour utiliser une valeur d'un nœud, écrivez {{list.body.results.0.url}}",
    );
    expect(detail.input).toMatchObject({ url: "list.body.results.0.url" });
  });

  it("joint les causes techniques d'une erreur réseau", async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("getaddrinfo ENOTFOUND pokeapi.co"), { code: "ENOTFOUND" }),
      });
    });

    const result = await executeWorkflow(chain({ url: "https://x.dev" }), { fetch: failing });
    if (result.status === "INVALID") throw new Error("graphe invalide");
    const list = result.nodeResults.find((r) => r.nodeId === "list");

    expect(list?.error).toBe("Nom de domaine introuvable (ENOTFOUND)");
    expect(list?.errorDetail).toBe(
      "TypeError: fetch failed\n← causé par Error: getaddrinfo ENOTFOUND pokeapi.co [ENOTFOUND]",
    );
    expect(list?.input).toMatchObject({ url: "https://pokeapi.co/api/v2/pokemon/" });
  });
});
