import { create } from "zustand";
import type { AuthClient, AuthUser } from "./auth-client.ts";
import { authErrorMessage } from "./auth-errors.ts";

// loading : session pas encore restaurée (ou session de démo en cours d'ouverture).
// demo : session de démo (compte anonyme), éditeur accessible avec des quotas réduits.
// signedOut : sessions de démo indisponibles, seul l'écran de connexion reste.
// unverified : connecté, mais l'API refusera tant que l'adresse email n'est pas vérifiée.
export type AuthStatus = "loading" | "signedOut" | "demo" | "unverified" | "signedIn";

// Écran de connexion ouvert par-dessus l'éditeur depuis une session de démo
export type LoginMode = "signIn" | "signUp";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  busy: boolean;
  error: string | null;
  // Information sans erreur (ex. email envoyé)
  notice: string | null;
  login: LoginMode | null;
  // Firebase ou l'API refuse les sessions de démo : on ne réessaie pas d'en ouvrir une
  demoUnavailable: boolean;
  // Écoute la session Firebase ; renvoie la fonction de désabonnement
  start: () => () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  checkVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  openLogin: (mode: LoginMode) => void;
  closeLogin: () => void;
  // L'API a refusé le jeton (401) : nouvelle session
  sessionRejected: () => Promise<void>;
  // L'API refuse les sessions de démo (403 DEMO_SESSIONS_DISABLED) : connexion obligatoire
  demoRefused: () => Promise<void>;
  clearMessages: () => void;
}

const statusOf = (user: AuthUser | null): AuthStatus => {
  if (user === null) return "signedOut";
  if (user.anonymous) return "demo";
  return user.emailVerified ? "signedIn" : "unverified";
};

export const RESET_NOTICE =
  "Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé.";
export const VERIFICATION_NOTICE = "Un nouveau lien de vérification vient d'être envoyé.";
export const NOT_VERIFIED_YET =
  "L'adresse n'est pas encore vérifiée : ouvrez le lien reçu par email, puis réessayez.";
export const SESSION_REJECTED = "Votre session n'est plus valide : reconnectez-vous.";
export const DEMO_UNAVAILABLE =
  "Les sessions de démo sont suspendues pour le moment : connectez-vous avec un compte.";

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

    // Compte changé sans passer par onChange (liaison d'une session de démo : même uid)
    const linked = (user: AuthUser | null) => {
      if (user) set({ user, status: statusOf(user), login: null });
    };

    const isDemo = () => get().user?.anonymous === true;

    // Première visite, ou après une déconnexion : nouvelle session de démo, sans clic (A1, U4)
    const openDemoSession = async () => {
      try {
        await getClient().signInAnonymously();
      } catch {
        // Fournisseur anonyme désactivé dans Firebase, réseau… : écran de connexion seul
        set({ status: "signedOut", demoUnavailable: true });
      }
    };

    return {
      status: "loading",
      user: null,
      busy: false,
      error: null,
      notice: null,
      login: null,
      demoUnavailable: false,

      start: () =>
        getClient().onChange((user) => {
          if (user === null && !get().demoUnavailable) {
            set({ user: null, status: "loading", login: null });
            void openDemoSession();
            return;
          }
          set({ user, status: statusOf(user), login: null });
        }),

      // Depuis une session de démo : liaison, les workflows suivent le compte (U1)
      signInWithGoogle: () =>
        attempt(async () => {
          if (isDemo()) linked(await getClient().linkWithGoogle());
          else await getClient().signInWithGoogle();
        }),

      // Connexion à un compte existant : la session de démo est abandonnée (l'écran le dit)
      signInWithPassword: (email, password) =>
        attempt(() => getClient().signInWithPassword(email.trim(), password)),

      signUp: (email, password) =>
        attempt(async () => {
          if (isDemo()) linked(await getClient().linkWithPassword(email.trim(), password));
          else await getClient().signUp(email.trim(), password);
        }),

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

      openLogin: (mode) => set({ login: mode, error: null, notice: null }),

      closeLogin: () => set({ login: null, error: null, notice: null }),

      sessionRejected: async () => {
        await getClient()
          .signOut()
          .catch(() => {});
        set({ error: SESSION_REJECTED, notice: null });
      },

      demoRefused: async () => {
        if (!isDemo()) return;
        set({ demoUnavailable: true });
        await getClient()
          .signOut()
          .catch(() => {});
        set({ error: DEMO_UNAVAILABLE, notice: null });
      },

      clearMessages: () => set({ error: null, notice: null }),
    };
  });
}
