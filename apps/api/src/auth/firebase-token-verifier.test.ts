import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { createFirebaseTokenVerifier } from "./firebase-token-verifier.js";
import { InvalidTokenError } from "./identity.js";

const PROJECT = "flowops-test";
const KID = "cle-de-test";
const now = () => Math.floor(Date.now() / 1000);

// Jetons signés par une clé locale : mêmes vérifications qu'en vrai, sans réseau
describe("vérificateur de jetons Firebase", () => {
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  let keys: JWTVerifyGetKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "RS256" };
    keys = createLocalJWKSet({ keys: [jwk] });
  });

  const sign = (claims: JWTPayload = {}, key = privateKey) =>
    new SignJWT({
      aud: PROJECT,
      iss: `https://securetoken.google.com/${PROJECT}`,
      sub: "uid-alice",
      iat: now() - 60,
      exp: now() + 3600,
      auth_time: now() - 120,
      email: "alice@example.com",
      email_verified: true,
      name: "Alice",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .sign(key);

  const verify = (token: string) => createFirebaseTokenVerifier(PROJECT, keys)(token);

  it("renvoie l'identité d'un jeton valide", async () => {
    await expect(verify(await sign())).resolves.toEqual({
      uid: "uid-alice",
      email: "alice@example.com",
      emailVerified: true,
      name: "Alice",
    });
  });

  it("signale un email non vérifié ou absent", async () => {
    const identity = await verify(await sign({ email_verified: false, email: undefined }));
    expect(identity).toMatchObject({ email: undefined, emailVerified: false });
  });

  it.each<[string, JWTPayload]>([
    ["expiré", { exp: now() - 10 }],
    ["émis pour un autre projet", { aud: "autre-projet" }],
    ["émis par un autre émetteur", { iss: "https://securetoken.google.com/autre-projet" }],
    ["sans sujet", { sub: "" }],
    ["émis dans le futur", { iat: now() + 3600 }],
    ["authentifié dans le futur", { auth_time: now() + 3600 }],
    ["sans auth_time", { auth_time: undefined }],
  ])("refuse un jeton %s", async (_label, claims) => {
    await expect(verify(await sign(claims))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("refuse un jeton signé par une autre clé", async () => {
    await expect(verify(await sign({}, otherKey))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("refuse un jeton mal formé ou non signé", async () => {
    const payload = (await sign()).split(".")[1];
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${payload}.`;

    await expect(verify("pas-un-jwt")).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(verify(unsigned)).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
