import { describe, expect, it } from "vitest";
import { compare } from "./compare.js";

// Opérateurs partagés par la condition et le filtre de la transformation : comparaison stricte

describe("compare", () => {
  it.each([
    [200, 200, true],
    ["ok", "ok", true],
    [true, true, true],
    // Strict : un nombre n'est pas égal à sa forme texte, ni un booléen à 1
    [200, "200", false],
    [1, true, false],
    [undefined, "", false],
    [null, false, false],
  ])("eq : %j et %j → %s", (left, right, expected) => {
    expect(compare(left, "eq", right)).toBe(expected);
  });

  it.each([
    [404, 200, true],
    [200, "200", true],
    [200, 200, false],
    [undefined, "x", true],
  ])("neq : %j et %j → %s", (left, right, expected) => {
    expect(compare(left, "neq", right)).toBe(expected);
  });

  it.each([
    [10, "gt", 5, true],
    [5, "gt", 5, false],
    [-1, "lt", 0, true],
    [0, "lt", 0, false],
  ] as const)("%j %s %j → %s", (left, operator, right, expected) => {
    expect(compare(left, operator, right)).toBe(expected);
  });

  it.each([
    ["10", 5],
    [10, "5"],
    [undefined, 5],
    [null, 0],
  ])("gt et lt refusent %j comparé à %j, sans conversion", (left, right) => {
    expect(() => compare(left, "gt", right)).toThrow("L'opérateur gt nécessite deux nombres");
    expect(() => compare(left, "lt", right)).toThrow("L'opérateur lt nécessite deux nombres");
  });

  it.each([
    ["bulbasaur", "saur", true],
    ["bulbasaur", "SAUR", false],
    ["bulbasaur", "", true],
    [["overgrow", "chlorophyll"], "overgrow", true],
    [["overgrow"], "over", false],
    // Élément de liste comparé en strict, comme eq
    [[1, 2, 3], 2, true],
    [[1, 2, 3], "2", false],
  ])("contains : %j contient %j → %s", (left, right, expected) => {
    expect(compare(left, "contains", right)).toBe(expected);
  });

  it.each([
    [12345, "234"],
    ["12345", 234],
    [{ name: "bulbasaur" }, "name"],
    [undefined, "x"],
    [null, "x"],
  ])("contains : %j ne contient rien (ni nombre, ni objet, ni absent)", (left, right) => {
    expect(compare(left, "contains", right)).toBe(false);
  });

  it.each([
    [0, true],
    [false, true],
    ["", true],
    [[], true],
    [null, false],
    [undefined, false],
  ])("exists : %j → %s (seuls null et l'absence comptent comme vides)", (left, expected) => {
    expect(compare(left, "exists", undefined)).toBe(expected);
  });
});
