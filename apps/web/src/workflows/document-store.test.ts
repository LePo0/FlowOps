import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleWorkflow, type WorkflowDetail, type WorkflowGraph } from "@flowops/shared";
import { fromGraph, toGraph, type FlowNode } from "../editor/graph.ts";
import type { ApiResult, WorkflowsApi } from "./api.ts";
import { createDocumentStore, documentSnapshot, type DocumentDeps } from "./document-store.ts";

const ID = "40dceb9b-d6f8-413e-8d04-80ebd7f7f49d";
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const detail = (name: string, graph: WorkflowGraph): WorkflowDetail => ({
  id: ID,
  name,
  graph,
  createdAt: "2026-10-16T14:29:25.728Z",
  updatedAt: "2026-10-16T14:29:25.728Z",
});

// Éditeur simulé : un graphe courant, chargeable et modifiable
function setup(api: Partial<WorkflowsApi> = {}) {
  let nodes: FlowNode[] = fromGraph(sampleWorkflow).nodes;
  let edges = fromGraph(sampleWorkflow).edges;
  let lastOpened: string | null = null;
  const deps: DocumentDeps = {
    api: {
      list: vi.fn(),
      get: vi.fn(async () => ok(detail("Ouvert", sampleWorkflow))),
      create: vi.fn(async ({ name, graph }) => ok(detail(name, graph))),
      update: vi.fn(async (_id, { name, graph }) => ok(detail(name, graph))),
      remove: vi.fn(),
      ...api,
    },
    getGraph: () => toGraph(nodes, edges),
    getNodes: () => nodes,
    loadGraph: (graph) => ({ nodes, edges } = fromGraph(graph)),
    onDocumentChanged: vi.fn(),
    lastOpened: { get: () => lastOpened, set: (id) => (lastOpened = id) },
  };
  const store = createDocumentStore(deps);
  const isDirty = () =>
    documentSnapshot(store.getState().name, deps.getGraph()) !== store.getState().savedSnapshot;
  const rename = (id: string, name: string) =>
    (nodes = nodes.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, name } } : node,
    ));
  return { store, deps, isDirty, rename, lastOpened: () => lastOpened };
}

describe("useDocumentStore", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it("commence sans modification ni identifiant", () => {
    expect(ctx.store.getState().id).toBeNull();
    expect(ctx.isDirty()).toBe(false);
  });

  it("signale les modifications du graphe et du nom", () => {
    ctx.rename("http1", "Autre nom");
    expect(ctx.isDirty()).toBe(true);

    const other = setup();
    other.store.getState().setName("Mon workflow");
    expect(other.isDirty()).toBe(true);
  });

  it("crée le workflow au premier enregistrement, puis le met à jour", async () => {
    ctx.store.getState().setName("  Pokémons ");
    expect(await ctx.store.getState().save()).toBe(true);

    expect(ctx.deps.api.create).toHaveBeenCalledWith({ name: "Pokémons", graph: sampleWorkflow });
    expect(ctx.store.getState()).toMatchObject({ id: ID, name: "Pokémons", busy: null });
    expect(ctx.isDirty()).toBe(false);
    expect(ctx.lastOpened()).toBe(ID);

    ctx.rename("http1", "Modifié");
    await ctx.store.getState().save();
    expect(ctx.deps.api.update).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: "Pokémons" }),
    );
    expect(ctx.isDirty()).toBe(false);
  });

  it("donne un nom par défaut à un workflow sans titre", async () => {
    await ctx.store.getState().save();

    expect(ctx.deps.api.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sans titre" }),
    );
  });

  it("refuse d'enregistrer un nœud incomplet sans appeler l'API", async () => {
    ctx.store.getState().newDocument({
      nodes: [
        ...sampleWorkflow.nodes.filter((node) => node.type === "trigger"),
        {
          id: "http-1",
          type: "http",
          name: "Requête HTTP",
          position: { x: 0, y: 0 },
          config: { method: "GET", url: "" },
        },
      ],
      edges: [],
    });

    expect(await ctx.store.getState().save()).toBe(false);
    expect(ctx.deps.api.create).not.toHaveBeenCalled();
    expect(ctx.store.getState().error).toContain("« Requête HTTP » est incomplet : URL");
  });

  it("garde les modifications non enregistrées si l'API refuse", async () => {
    const failing = setup({
      create: vi.fn(async () => ({ ok: false as const, message: "API arrêtée" })),
    });
    failing.rename("http1", "Modifié");

    expect(await failing.store.getState().save()).toBe(false);
    expect(failing.store.getState().error).toBe("Enregistrement impossible : API arrêtée");
    expect(failing.isDirty()).toBe(true);
  });

  it("ouvre un workflow : graphe chargé, résultats effacés, rien à enregistrer", async () => {
    expect(await ctx.store.getState().open(ID)).toBe(true);

    expect(ctx.store.getState()).toMatchObject({ id: ID, name: "Ouvert" });
    expect(ctx.deps.onDocumentChanged).toHaveBeenCalled();
    expect(ctx.isDirty()).toBe(false);
  });

  it("repart d'un nouveau document sans identifiant", async () => {
    await ctx.store.getState().open(ID);
    const blank: WorkflowGraph = {
      nodes: sampleWorkflow.nodes.filter((node) => node.type === "trigger"),
      edges: [],
    };

    ctx.store.getState().newDocument(blank);

    expect(ctx.store.getState()).toMatchObject({ id: null, name: "" });
    expect(ctx.deps.getGraph()).toEqual(blank);
    expect(ctx.lastOpened()).toBeNull();
  });

  it("rouvre le dernier workflow, ou l'oublie s'il n'existe plus", async () => {
    ctx.deps.lastOpened.set(ID);
    await ctx.store.getState().restoreLast();
    expect(ctx.store.getState().id).toBe(ID);

    const gone = setup({
      get: vi.fn(async () => ({ ok: false as const, message: "Workflow introuvable" })),
    });
    gone.deps.lastOpened.set(ID);
    await gone.store.getState().restoreLast();
    expect(gone.lastOpened()).toBeNull();
    expect(gone.store.getState().id).toBeNull();
  });

  it("rend non enregistré le workflow ouvert quand il est supprimé", async () => {
    await ctx.store.getState().open(ID);

    ctx.store.getState().forget("un-autre-id");
    expect(ctx.store.getState().id).toBe(ID);

    ctx.store.getState().forget(ID);
    expect(ctx.store.getState().id).toBeNull();
    expect(ctx.lastOpened()).toBeNull();
    expect(ctx.isDirty()).toBe(true);
  });
});
