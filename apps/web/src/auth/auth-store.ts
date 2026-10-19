import { create } from "zustand";
import type { AuthClient, AuthUser } from "./auth-client.ts";
import { authErrorMessage } from "./auth-errors.ts";

// loading : session pas encore restaurée. unverified : connecté, mais l'API refusera tant que
// l'adresse email n'est pas vérifiée (comptes email/mot de passe).
export type AuthStatus = "loading" | "signedOut" | "unverified" | "signedIn";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  busy: boolean;
  error: string | null;
  // Information sans erreur (ex. email envoyé)
  notice: string | null;
  // Écoute la session Firebase ; renvoie la fonction de désabonnement
  start: () => () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  checkVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  // L'API a refusé le jeton (401) : retour à l'écran de connexion
  sessionRejected: () => Promise<void>;
  clearMessages: () => void;
}

const statusOf = (user: AuthUser | null): AuthStatus =>
  user === null ? "signedOut" : user.emailVerified ? "signedIn" : "unverified";

export const RESET_NOTICE =
  "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé.";
export const VERIFICATION_NOTICE = "Un nouveau lien de vérification vient d'être envoyé.";
export const NOT_VERIFIED_YET =
  "L'adresse n'est pas encore vérifiée : ouvrez le lien reçu par email, puis réessayez.";
export const SESSION_REJECTED = "Votre session n'est plus valide : reconnectez-vous.";

// getClient : créé à la première utilisation (Firebase n'est initialisé que si on s'en sert)
export function createAuthStore(getClient: () => AuthClient) {
  return create<AuthState>()((set, get) => {
    // Une opération à la fois ; l'erreur affichée est traduite, la notice remplace la précédente
    const attempt = async (operation: () => Promise<void>, notice: string | null = null) => {
      if (get().busy) return;
      set({ busy: true, error: null, notice: null });
      try {
        await operation();
        set({ busy: false, notice });
      } catch (error) {
        set({ busy: false, error: authErrorMessage(error) });
      }
    };

    return {
      status: "loading",
      user: null,
      busy: false,
      error: null,
      notice: null,

      start: () => getClient().onChange((user) => set({ user, status: statusOf(user) })),

      signInWithGoogle: () => attempt(() => getClient().signInWithGoogle()),

      signInWithPassword: (email, password) =>
        attempt(() => getClient().signInWithPassword(email.trim(), password)),

      signUp: (email, password) => attempt(() => getClient().signUp(email.trim(), password)),

      sendPasswordReset: (email) =>
        attempt(() => getClient().sendPasswordReset(email.trim()), RESET_NOTICE),

      resendVerification: () => attempt(() => getClient().sendVerification(), VERIFICATION_NOTICE),

      // onChange ne se déclenche pas quand seule la vérification change : on relit le compte
      checkVerification: async () => {
        if (get().busy) return;
        set({ busy: true, error: null, notice: null });
        try {
          const user = await getClient().reload();
          const status = statusOf(user);
          set({
            busy: false,
            user,
            status,
            error: status === "unverified" ? NOT_VERIFIED_YET : null,
          });
        } catch (error) {
          set({ busy: false, error: authErrorMessage(error) });
        }
      },

      signOut: () => attempt(() => getClient().signOut()),

      sessionRejected: async () => {
        await getClient()
          .signOut()
          .catch(() => {});
        set({ error: SESSION_REJECTED, notice: null });
      },

      clearMessages: () => set({ error: null, notice: null }),
    };
  });
}
