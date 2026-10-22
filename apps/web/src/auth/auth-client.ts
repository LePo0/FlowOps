// Compte connecté, tel que l'éditeur en a besoin
export interface AuthUser {
  // Identifiant Firebase : un changement d'uid est un changement de compte
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  // Session de démo : compte anonyme Firebase (docs/security/demo-sessions.md)
  anonymous: boolean;
}

// Opérations de connexion : Firebase en vrai (firebase-client.ts), un double dans les tests.
// Les erreurs portent le `code` de Firebase (ex. auth/invalid-credential), voir auth-errors.ts.
export interface AuthClient {
  // Appelé une première fois avec le compte restauré (ou null), puis à chaque changement de compte
  onChange(listener: (user: AuthUser | null) => void): () => void;
  // Ouvre une session de démo
  signInAnonymously(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  // Crée le compte et envoie le lien de vérification de l'adresse
  signUp(email: string, password: string): Promise<void>;
  // Transforme la session de démo en compte Google, avec le même uid (workflows conservés).
  // Si ce compte Google existe déjà, connexion à ce compte : renvoie null, onChange suit.
  linkWithGoogle(): Promise<AuthUser | null>;
  // Transforme la session de démo en compte email/mot de passe et envoie le lien de vérification
  linkWithPassword(email: string, password: string): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  sendVerification(): Promise<void>;
  // Relit le compte (adresse vérifiée entre-temps ?) et renouvelle le jeton envoyé à l'API
  reload(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  // Jeton d'identité courant, renouvelé automatiquement avant expiration
  getToken(): Promise<string | null>;
}
