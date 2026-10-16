import { describe, it, expect } from "vitest";
import type { FlowNode } from "../graph.ts";
import {
  convertRight,
  formatHeaders,
  formatPick,
  parseHeaders,
  parseOptionalNumber,
  parsePick,
  rightKind,
  validateNode,
} from "./form-values.ts";

describe("en-têtes HTTP", () => {
  it("fait l'aller-retour entre texte et objet", () => {
    const headers = { Accept: "application/json", "X-Token": "a:b" };

    expect(parseHeaders(formatHeaders(headers))).toEqual(headers);
  });

  it("ignore les lignes incomplètes et donne undefined sans en-tête", () => {
    expect(parseHeaders("Accept: text/plain\nsans séparateur\n: sans nom\n")).toEqual({
      Accept: "text/plain",
    });
    expect(parseHeaders("  \n")).toBeUndefined();
  });
});

describe("champs à conserver", () => {
  it("découpe sur les virgules et retire les vides", () => {
    expect(parsePick(" title, price ,, ")).toEqual(["title", "price"]);
    expect(parsePick(" , ")).toBeUndefined();
    expect(formatPick(["title", "price"])).toBe("title, price");
  });
});

describe("nombre optionnel", () => {
  it("donne undefined pour un texte vide ou invalide", () => {
    expect(parseOptionalNumber("5000")).toBe(5000);
    expect(parseOptionalNumber("")).toBeUndefined();
    expect(parseOptionalNumber("abc")).toBeUndefined();
  });
});

describe("valeur comparée", () => {
  it("déduit le type de la valeur", () => {
    expect(rightKind(200)).toBe("number");
    expect(rightKind(false)).toBe("boolean");
    expect(rightKind("200")).toBe("string");
    expect(rightKind(undefined)).toBe("string");
  });

  it("convertit la valeur quand on change de type", () => {
    expect(convertRight("200", "number")).toBe(200);
    expect(convertRight("abc", "number")).toBeUndefined();
    expect(convertRight(200, "string")).toBe("200");
    expect(convertRight("false", "boolean")).toBe(false);
    expect(convertRight("oui", "boolean")).toBe(true);
  });
});

describe("validateNode", () => {
  const httpNode = (url: string): FlowNode => ({
    id: "http-1",
    type: "http",
    position: { x: 0, y: 0 },
    data: { type: "http", name: "Requête", config: { method: "GET", url } },
  });

  it("ne renvoie aucune erreur pour un nœud complet", () => {
    expect(validateNode(httpNode("https://example.com"))).toEqual({});
  });

  it("signale un champ obligatoire vide à son chemin", () => {
    expect(validateNode(httpNode(""))).toEqual({ "config.url": "Champ obligatoire" });
  });
});
