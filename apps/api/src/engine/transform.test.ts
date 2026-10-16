import { describe, it, expect } from "vitest";
import { applyTransform } from "./transform.js";

// Extrait réel de GET https://pokeapi.co/api/v2/pokemon/1/
const abilities = [
  {
    is_hidden: false,
    slot: 1,
    ability: { name: "overgrow", url: "https://pokeapi.co/api/v2/ability/65/" },
  },
  {
    is_hidden: true,
    slot: 3,
    ability: { name: "chlorophyll", url: "https://pokeapi.co/api/v2/ability/34/" },
  },
];

describe("applyTransform", () => {
  it("renvoie la valeur telle quelle sans option", () => {
    expect(applyTransform(abilities, {}).output).toBe(abilities);
  });

  it("extrait un champ imbriqué de chaque élément en liste simple", () => {
    expect(applyTransform(abilities, { extract: "ability.name" })).toEqual({
      input: { items: 2 },
      output: ["overgrow", "chlorophyll"],
    });
  });

  it("filtre les éléments puis extrait", () => {
    const result = applyTransform(abilities, {
      filter: { field: "is_hidden", operator: "eq", value: false },
      extract: "ability.name",
    });

    expect(result).toEqual({ input: { items: 2, kept: 1 }, output: ["overgrow"] });
  });

  it("filtre sur un champ imbriqué et garde les éléments entiers", () => {
    const result = applyTransform(abilities, {
      filter: { field: "ability.name", operator: "eq", value: "chlorophyll" },
    });

    expect(result.output).toEqual([abilities[1]]);
  });

  it("conserve des champs imbriqués en gardant leur structure", () => {
    expect(applyTransform(abilities, { pick: ["ability.name", "slot"] }).output).toEqual([
      { ability: { name: "overgrow" }, slot: 1 },
      { ability: { name: "chlorophyll" }, slot: 3 },
    ]);
  });

  it("signale un champ à conserver absent de tous les éléments", () => {
    expect(() => applyTransform(abilities, { pick: ["ability.nom"] })).toThrow(
      "Champ introuvable : ability.nom",
    );
  });

  it("signale un champ à extraire absent de tous les éléments", () => {
    expect(() => applyTransform(abilities, { extract: "name" })).toThrow(
      "Champ introuvable dans les éléments : name",
    );
  });

  it("tolère un champ absent de certains éléments seulement", () => {
    const items = [{ name: "a", tag: "x" }, { name: "b" }];

    expect(applyTransform(items, { extract: "tag" }).output).toEqual(["x", null]);
    expect(applyTransform(items, { pick: ["tag"] }).output).toEqual([{ tag: "x" }, {}]);
  });

  it("travaille aussi sur un objet seul", () => {
    expect(applyTransform(abilities[0], { extract: "ability.name" }).output).toBe("overgrow");
    expect(applyTransform(abilities[0], { pick: ["slot"] }).output).toEqual({ slot: 1 });
  });

  it("refuse un filtre sur autre chose qu'une liste", () => {
    expect(() =>
      applyTransform(abilities[0], { filter: { field: "slot", operator: "exists" } }),
    ).toThrow("Le filtre nécessite une liste");
  });

  it("indique l'élément fautif quand la comparaison est impossible", () => {
    const items = [{ size: 1 }, { size: "grand" }];

    expect(() =>
      applyTransform(items, { filter: { field: "size", operator: "gt", value: 0 } }),
    ).toThrow("Filtre, élément 1 : L'opérateur gt nécessite deux nombres");
  });

  it("donne une liste vide quand rien ne passe le filtre", () => {
    const result = applyTransform(abilities, {
      filter: { field: "slot", operator: "gt", value: 10 },
      extract: "ability.name",
    });

    expect(result).toEqual({ input: { items: 2, kept: 0 }, output: [] });
  });

  it("n'altère pas le prototype avec une clé __proto__", () => {
    const items = [JSON.parse('{"__proto__": {"pollue": true}}')];
    const [picked] = applyTransform(items, { pick: ["__proto__"] }).output as object[];

    expect(Object.hasOwn(picked ?? {}, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>)["pollue"]).toBeUndefined();
    expect(Object.getPrototypeOf(picked)).toBe(Object.prototype);
  });
});
