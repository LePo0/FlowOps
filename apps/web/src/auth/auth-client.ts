// Compte connecté, tel que l'éditeur en a besoin
export interface AuthUser {
  email: string | null;
  name: string | null;
  emailVerified: boolean;
}

// Opérations de connexion : Firebase en vrai (firebase-client.ts), un double dans les tests.
// Les erreurs portent le `code` de Firebase (ex. auth/invalid-credential), voir auth-errors.ts.
export interface AuthClient {
  // Appelé une première fois avec le compte restauré (ou null), puis à chaque changement
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  // Crée le compte et envoie le lien de vérification de l'adresse
  signUp(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  sendVerification(): Promise<void>;
  // Relit le compte (adresse vérifiée entre-temps ?) et renouvelle le jeton envoyé à l'API
  reload(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  // Jeton d'identité courant, renouvelé automatiquement avant expiration
  getToken(): Promise<string | null>;
}
