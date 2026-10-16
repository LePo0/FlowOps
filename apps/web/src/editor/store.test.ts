import { beforeEach, describe, it, expect } from "vitest";
import { demoWorkflow } from "@flowops/shared";
import { useEditorStore } from "./store.ts";

const store = () => useEditorStore.getState();

describe("useEditorStore", () => {
  beforeEach(() => {
    store().loadGraph(demoWorkflow);
  });

  it("démarre avec le workflow de démo", () => {
    expect(store().getGraph()).toEqual(demoWorkflow);
  });

  it("ajoute un nœud avec un identifiant libre et une config par défaut", () => {
    const first = store().addNode("http", { x: 10, y: 20 });
    const second = store().addNode("http", { x: 30, y: 40 });

    expect([first, second]).toEqual(["http-1", "http-2"]);
    expect(store().getGraph().nodes.at(-1)).toEqual({
      id: "http-2",
      type: "http",
      name: "Requête HTTP",
      position: { x: 30, y: 40 },
      config: { method: "GET", url: "" },
    });
  });

  it("sélectionne seul le nœud ajouté", () => {
    store().onNodesChange([{ type: "select", id: "trigger", selected: true }]);
    store().addNode("condition", { x: 0, y: 0 });

    const selected = store().nodes.filter((node) => node.selected);
    expect(selected.map((node) => node.id)).toEqual(["condition-1"]);
  });

  it("sélectionne un seul nœud à la demande", () => {
    store().onNodesChange([{ type: "select", id: "trigger", selected: true }]);
    store().selectNode("check");

    const selected = store().nodes.filter((node) => node.selected);
    expect(selected.map((node) => node.id)).toEqual(["check"]);
  });

  it("refuse un second déclencheur", () => {
    expect(store().addNode("trigger", { x: 0, y: 0 })).toBeNull();
    expect(store().nodes.filter((node) => node.type === "trigger")).toHaveLength(1);
  });

  it("supprime un nœud avec ses arêtes", () => {
    store().removeNode("http1");

    const graph = store().getGraph();
    expect(graph.nodes.map((node) => node.id)).toEqual(["trigger", "check", "names"]);
    expect(graph.edges.map((edge) => edge.id)).toEqual(["e3"]);
  });

  it("ne partage pas la config par défaut entre deux nœuds", () => {
    store().addNode("transform", { x: 0, y: 0 });
    store().addNode("transform", { x: 0, y: 0 });
    const [a, b] = store().nodes.slice(-2);

    expect(a?.data.config).not.toBe(b?.data.config);
  });

  it("transforme une connexion depuis une condition en arête avec branche", () => {
    store().addNode("http", { x: 0, y: 0 });
    store().onConnect({
      source: "check",
      sourceHandle: "false",
      target: "http-1",
      targetHandle: null,
    });

    expect(store().getGraph().edges.at(-1)).toEqual({
      id: "check.false->http-1",
      source: "check",
      target: "http-1",
      branch: "false",
    });
  });

  it("ignore une connexion invalide (ici un cycle)", () => {
    store().onConnect({ source: "names", sourceHandle: null, target: "http1", targetHandle: null });

    expect(store().getGraph().edges).toEqual(demoWorkflow.edges);
  });

  it("met à jour les données d'un nœud", () => {
    store().updateNodeData("http1", {
      type: "http",
      name: "GET utilisateurs",
      config: { method: "GET", url: "https://dummyjson.com/users" },
    });

    const http1 = store()
      .getGraph()
      .nodes.find((node) => node.id === "http1");
    expect(http1).toMatchObject({
      name: "GET utilisateurs",
      config: { url: "https://dummyjson.com/users" },
    });
  });

  it("applique les déplacements et suppressions venant de React Flow", () => {
    store().onNodesChange([
      { type: "position", id: "trigger", position: { x: 5, y: 6 } },
      { type: "remove", id: "names" },
    ]);
    store().onEdgesChange([{ type: "remove", id: "e3" }]);

    const graph = store().getGraph();
    expect(graph.nodes.find((node) => node.id === "trigger")?.position).toEqual({ x: 5, y: 6 });
    expect(graph.nodes.map((node) => node.id)).not.toContain("names");
    expect(graph.edges.map((edge) => edge.id)).toEqual(["e1", "e2"]);
  });
});
