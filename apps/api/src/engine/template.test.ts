import { describe, it, expect } from "vitest";
import { interpolate } from "./template.js";

const outputs = new Map<string, unknown>([
  [
    "http1",
    {
      status: 200,
      body: {
        results: [{ name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" }],
        tags: ["a", "b"],
      },
    },
  ],
  ["names", "bulbasaur"],
]);

describe("interpolate", () => {
  it("remplace une référence par une URL complète", () => {
    expect(interpolate("{{http1.body.results.0.url}}", outputs)).toBe(
      "https://pokeapi.co/api/v2/pokemon/1/",
    );
  });

  it("insère plusieurs valeurs dans un texte, espaces tolérés", () => {
    expect(interpolate("https://x.dev/{{ names }}?status={{http1.status}}", outputs)).toBe(
      "https://x.dev/bulbasaur?status=200",
    );
  });

  it("sérialise objets et listes en JSON", () => {
    expect(interpolate('{"tags": {{http1.body.tags}}}', outputs)).toBe('{"tags": ["a","b"]}');
  });

  it("laisse intact un texte sans référence", () => {
    expect(interpolate("https://pokeapi.co/api/v2/pokemon/", outputs)).toBe(
      "https://pokeapi.co/api/v2/pokemon/",
    );
  });

  it("signale une référence vide", () => {
    expect(() => interpolate("{{http1.body.results.5.url}}", outputs)).toThrow(
      "La référence http1.body.results.5.url est vide",
    );
  });

  it("signale un nœud inconnu ou non exécuté", () => {
    expect(() => interpolate("{{http2.body}}", outputs)).toThrow(
      "Référence inconnue ou nœud non exécuté : http2.body",
    );
  });
});
