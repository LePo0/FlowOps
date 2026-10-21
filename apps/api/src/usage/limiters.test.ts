import { describe, expect, it } from "vitest";
import type { NodeResult } from "@flowops/shared";
import { createConcurrencyLimiter, createRateLimiter, ipKey } from "./limiters.js";
import { fitStoredSize, NOT_KEPT } from "./stored-size.js";

describe("limite par fenêtre glissante", () => {
  it("accepte `limit` requêtes par fenêtre, puis indique quand réessayer", () => {
    let time = 0;
    const limiter = createRateLimiter(60_000, () => time);

    expect(limiter.hit("a", 2)).toEqual({ ok: true });
    time = 20_000;
    expect(limiter.hit("a", 2)).toEqual({ ok: true });
    expect(limiter.hit("a", 2)).toEqual({ ok: false, retryAfterSeconds: 40 });
    // Les clés sont indépendantes
    expect(limiter.hit("b", 2)).toEqual({ ok: true });

    // La première requête sort de la fenêtre : une place se libère
    time = 60_001;
    expect(limiter.hit("a", 2)).toEqual({ ok: true });
    expect(limiter.hit("a", 2).ok).toBe(false);
  });

  it("une requête refusée ne prolonge pas l'attente", () => {
    let time = 0;
    const limiter = createRateLimiter(60_000, () => time);
    limiter.hit("a", 1);

    for (time = 1000; time < 60_000; time += 10_000) limiter.hit("a", 1);

    time = 60_001;
    expect(limiter.hit("a", 1)).toEqual({ ok: true });
  });
});

describe("exécutions simultanées", () => {
  it("refuse au-delà du maximum et libère une place une seule fois", () => {
    const limiter = createConcurrencyLimiter();

    const release = limiter.acquire("a", 1);
    expect(release).not.toBeNull();
    expect(limiter.acquire("a", 1)).toBeNull();
    expect(limiter.acquire("b", 1)).not.toBeNull();

    release?.();
    release?.();
    const again = limiter.acquire("a", 1);
    expect(again).not.toBeNull();
    expect(limiter.acquire("a", 1)).toBeNull();
  });
});

describe("clé d'adresse IP", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["2001:db8:1:2::1", "2001:db8:1:2::/64"],
    ["2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
    [undefined, "inconnue"],
    ["pas-une-adresse", "inconnue"],
  ])("%s → %s", (ip, key) => {
    expect(ipKey(ip)).toBe(key);
  });
});

describe("taille conservée dans l'historique", () => {
  const result = (nodeId: string, size: number): NodeResult => ({
    nodeId,
    status: "SUCCESS",
    input: { url: "https://api.test" },
    output: "x".repeat(size),
    durationMs: 1,
  });

  it("garde tout sans limite ou sous la limite", () => {
    const results = [result("a", 100), result("b", 100)];

    expect(fitStoredSize(results, null)).toBe(results);
    expect(fitStoredSize(results, 10_000)).toEqual(results);
  });

  it("remplace l'entrée et la sortie à partir du nœud qui dépasse, garde le reste", () => {
    const results = [
      result("a", 600),
      result("b", 600),
      { nodeId: "c", status: "SKIPPED", durationMs: 0 } as NodeResult,
    ];

    const fitted = fitStoredSize(results, 1000);

    expect(fitted[0]).toEqual(results[0]);
    expect(fitted[1]).toEqual({
      nodeId: "b",
      status: "SUCCESS",
      input: NOT_KEPT,
      output: NOT_KEPT,
      durationMs: 1,
    });
    // Rien à remplacer pour un nœud sans entrée ni sortie
    expect(fitted[2]).toEqual(results[2]);
  });
});
