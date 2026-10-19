import { describe, expect, it } from "vitest";
import { createNetworkPolicy } from "./policy.js";

// Scénarios de docs/security/http-node.md (identifiants entre crochets)

const saas = createNetworkPolicy();
const company = createNetworkPolicy({
  allowed: "10.20.0.0/16, *.interne.test, fd12:3456::/32",
  denied: "10.20.99.0/24",
});

const HOST = "exemple.test";

describe("politique réseau, mode par défaut (SaaS)", () => {
  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "172.32.0.1", // juste après 172.16.0.0/12
    "2606:4700::1111",
    "::ffff:93.184.216.34",
  ])("[C1] autorise l'adresse publique %s", (address) => {
    expect(saas.decide(HOST, address)).toBe("allow");
  });

  it.each(["127.0.0.1", "127.8.8.8", "::1"])("[C2] refuse la boucle locale %s", (address) => {
    expect(saas.decide("localhost", address)).toBe("deny");
  });

  it.each(["169.254.169.254", "169.254.1.1", "fe80::1"])(
    "[C3] refuse le lien local et les métadonnées %s",
    (address) => {
      expect(saas.decide("metadata.google.internal", address)).toBe("deny");
    },
  );

  it.each([
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "fd00::1",
    "0.0.0.0",
    "::",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
  ])("[C4] refuse l'adresse non publique %s", (address) => {
    expect(saas.decide(HOST, address)).toBe("deny");
  });

  it.each(["::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254"])(
    "[C7] refuse l'adresse IPv4 interdite écrite en IPv6 %s",
    (address) => {
      expect(saas.decide(HOST, address)).toBe("deny");
    },
  );

  it("[C6] refuse un domaine interne quand aucune liste n'est configurée", () => {
    expect(saas.decide("api.interne.test", "10.20.1.5")).toBe("deny");
  });
});

describe("politique réseau, mode entreprise", () => {
  it("[C1] autorise toujours les adresses publiques", () => {
    expect(company.decide(HOST, "93.184.216.34")).toBe("allow");
  });

  it("[C4] autorise un réseau privé listé, et lui seul", () => {
    expect(company.decide(HOST, "10.20.1.5")).toBe("allow");
    expect(company.decide(HOST, "fd12:3456::1")).toBe("allow");
    expect(company.decide(HOST, "10.21.0.1")).toBe("deny");
    expect(company.decide(HOST, "192.168.1.1")).toBe("deny");
  });

  it("[C5] fait primer les exclusions sur les autorisations", () => {
    expect(company.decide(HOST, "10.20.99.5")).toBe("deny");
  });

  it("[C6] autorise un domaine listé vers une adresse privée, pas un domaine voisin", () => {
    expect(company.decide("api.interne.test", "192.168.7.7")).toBe("allow");
    expect(company.decide("API.Interne.Test", "192.168.7.7")).toBe("allow");
    expect(company.decide("interne.test.attaquant.test", "192.168.7.7")).toBe("deny");
    expect(company.decide("faux-interne.test", "192.168.7.7")).toBe("deny");
  });

  it("[C5] applique aussi les exclusions à un domaine listé", () => {
    expect(company.decide("api.interne.test", "10.20.99.5")).toBe("deny");
  });

  it.each(["127.0.0.1", "::1", "169.254.169.254", "0.0.0.0"])(
    "[C2][C3] refuse %s même pour un domaine listé",
    (address) => {
      expect(company.decide("api.interne.test", address)).toBe("deny");
    },
  );
});

describe("configuration de la politique", () => {
  it.each(["10.20.0.0/33", "300.1.1.1/8", "pas une cible", "10.0.0.0/8;", "*.", "http://x.test"])(
    "[K1] refuse l'entrée invalide « %s » en la citant",
    (entry) => {
      expect(() => createNetworkPolicy({ allowed: entry })).toThrow(entry);
      expect(() => createNetworkPolicy({ denied: entry })).toThrow(entry);
    },
  );

  it("[K1] accepte une liste vide, des espaces et une virgule finale", () => {
    expect(() => createNetworkPolicy({ allowed: "", denied: " 10.0.0.0/8 , " })).not.toThrow();
  });

  it("[K2] garde les interdictions permanentes avec une liste qui autorise tout", () => {
    const open = createNetworkPolicy({ allowed: "0.0.0.0/0, ::/0" });

    expect(open.decide(HOST, "10.1.2.3")).toBe("allow");
    expect(open.decide(HOST, "127.0.0.1")).toBe("deny");
    expect(open.decide(HOST, "169.254.169.254")).toBe("deny");
    expect(open.decide(HOST, "::1")).toBe("deny");
  });
});
