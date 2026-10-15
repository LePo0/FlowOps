import { describe, it, expect } from "vitest";
import { resolveReference } from "./resolve-reference.js";

const outputs = new Map<string, unknown>([
    ["http1", { status: 200, body: { products: [{ title: "A" }] } }],
]);

describe("resolveReference", () => {
    it("lit une valeur imbriquée", () => {
        expect(resolveReference("http1.status", outputs)).toBe(200);
        expect(resolveReference("http1.body.products.0.title", outputs)).toBe("A");
    });

    it("retourne undefined pour un chemin absent", () => {
        expect(resolveReference("http1.body.absent", outputs)).toBeUndefined();
    });

    it("ignore les propriétés héritées", () => {
        expect(resolveReference("http1.constructor", outputs)).toBeUndefined();
    });

    it("lance une erreur pour un nœud non exécuté", () => {
        expect(() => resolveReference("inconnu.x", outputs)).toThrow();
    });
});
