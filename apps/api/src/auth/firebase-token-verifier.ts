import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { InvalidTokenError, type VerifyToken } from "./identity.js";

// Clés publiques qui signent les jetons d'identité Firebase (rotation gérée par Google)
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// Erreurs de jose qui ne disent rien du jeton : les clés n'ont pas pu être obtenues
// (retour `boolean` explicite : un prédicat de type inféré réduirait `error` à never ensuite)
const isKeyFetchFailure = (error: unknown): boolean =>
  error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid;

// Fournisseur de connexion, dans le claim `firebase` signé avec le reste du jeton
const isAnonymousSignIn = (claim: unknown): boolean =>
  typeof claim === "object" &&
  claim !== null &&
  "sign_in_provider" in claim &&
  claim.sign_in_provider === "anonymous";

/**
 * Vérifie un jeton d'identité Firebase selon la documentation « Verify ID tokens using a
 * third-party JWT library » : signature RS256, `aud` = projet, `iss` = securetoken du projet,
 * `exp` futur, `iat` et `auth_time` passés, `sub` non vide.
 * `keys` n'est remplacé que dans les tests (clés locales, sans réseau).
 */
export function createFirebaseTokenVerifier(
  projectId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL)),
): VerifyToken {
  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        requiredClaims: ["exp", "iat", "sub", "auth_time"],
      }));
    } catch (error) {
      if (error instanceof errors.JOSEError && !isKeyFetchFailure(error)) {
        throw new InvalidTokenError(error.message, { cause: error });
      }
      throw error;
    }

    const now = Date.now() / 1000;
    const { sub, iat, auth_time: authTime, email, email_verified: emailVerified, name } = payload;
    const { firebase } = payload;
    if (!sub || typeof iat !== "number" || iat > now) {
      throw new InvalidTokenError("Claims sub ou iat invalides");
    }
    if (typeof authTime !== "number" || authTime > now) {
      throw new InvalidTokenError("Claim auth_time invalide");
    }

    return {
      uid: sub,
      email: typeof email === "string" ? email : undefined,
      emailVerified: emailVerified === true,
      name: typeof name === "string" ? name : undefined,
      anonymous: isAnonymousSignIn(firebase),
    };
  };
}
