import { describe, it, expect } from "vitest";
import { NodeError, technicalDetail } from "./node-error.js";

describe("technicalDetail", () => {
  it("déroule la chaîne des causes avec leurs codes", () => {
    const socket = Object.assign(new Error("self-signed certificate in certificate chain"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
    const fetchError = new TypeError("fetch failed", { cause: socket });
    const error = new NodeError("Certificat TLS non reconnu", { input: {}, cause: fetchError });

    expect(technicalDetail(error)).toBe(
      "TypeError: fetch failed\n← causé par Error: self-signed certificate in certificate chain [SELF_SIGNED_CERT_IN_CHAIN]",
    );
  });

  it("ne renvoie rien sans cause", () => {
    expect(technicalDetail(new Error("pick nécessite des objets"))).toBeUndefined();
    expect(technicalDetail("texte")).toBeUndefined();
  });
});
