// Identité extraite d'un jeton dont la signature et les claims ont été vérifiés
export interface VerifiedIdentity {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
  name: string | undefined;
  // Compte anonyme Firebase (claim firebase.sign_in_provider = "anonymous") : session de démo
  anonymous: boolean;
}

// Jeton refusé : expiré, mal signé, émis pour un autre projet… Réponse 401.
// Toute autre erreur (clés publiques injoignables, par exemple) est une panne : réponse 500.
export class InvalidTokenError extends Error {
  override name = "InvalidTokenError";
}

export type VerifyToken = (token: string) => Promise<VerifiedIdentity>;

export interface UserDirectory {
  // Identifiant interne (User.id) du compte, créé à sa première requête
  resolve(identity: VerifiedIdentity): Promise<string>;
}

export interface AuthDeps {
  verifyToken: VerifyToken;
  users: UserDirectory;
  // false : les jetons anonymes sont refusés (interrupteur DEMO_SESSIONS_ENABLED)
  demoSessionsEnabled: boolean;
}
