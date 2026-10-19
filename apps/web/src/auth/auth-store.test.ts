import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthClient, AuthUser } from "./auth-client.ts";
import { authErrorMessage } from "./auth-errors.ts";
import { createAuthStore, NOT_VERIFIED_YET, RESET_NOTICE, SESSION_REJECTED } from "./auth-store.ts";

const verified: AuthUser = { email: "alice@test.local", name: "Alice", emailVerified: true };
const unverified: AuthUser = { ...verified, emailVerified: false };
const firebaseError = (code: string) => Object.assign(new Error(code), { code });

// Double du client Firebase : `emit` simule un changement de session
function fakeClient() {
  let listener: (user: AuthUser | null) => void = () => {};
  const client = {
    onChange: vi.fn((next: typeof listener) => {
      listener = next;
      return () => {};
    }),
    signInWithGoogle: vi.fn(async () => {}),
    signInWithPassword: vi.fn(async () => {}),
    signUp: vi.fn(async () => {}),
    sendPasswordReset: vi.fn(async () => {}),
    sendVerification: vi.fn(async () => {}),
    reload: vi.fn(async (): Promise<AuthUser | null> => verified),
    signOut: vi.fn(async () => listener(null)),
    getToken: vi.fn(async () => "jeton"),
  } satisfies AuthClient;
  return { client, emit: (user: AuthUser | null) => listener(user) };
}

describe("store d'authentification", () => {
  let fake: ReturnType<typeof fakeClient>;
  let store: ReturnType<typeof createAuthStore>;

  beforeEach(() => {
    fake = fakeClient();
    store = createAuthStore(() => fake.client);
    store.getState().start();
  });

  it("attend la restauration de la session, puis suit les connexions", () => {
    expect(createAuthStore(() => fake.client).getState().status).toBe("loading");

    fake.emit(null);
    expect(store.getState().status).toBe("signedOut");
    fake.emit(verified);
    expect(store.getState()).toMatchObject({ status: "signedIn", user: verified });
  });

  it("met de côté un compte dont l'adresse n'est pas vérifiée", () => {
    fake.emit(unverified);

    expect(store.getState().status).toBe("unverified");
  });

  it("traduit les erreurs de Firebase et retire les espaces autour de l'email", async () => {
    fake.client.signInWithPassword.mockRejectedValueOnce(firebaseError("auth/invalid-credential"));

    await store.getState().signInWithPassword("  alice@test.local ", "mauvais");

    expect(fake.client.signInWithPassword).toHaveBeenCalledWith("alice@test.local", "mauvais");
    expect(store.getState()).toMatchObject({
      busy: false,
      error: "Email ou mot de passe incorrect.",
    });
  });

  it("n'affiche rien si l'utilisateur ferme la fenêtre Google", async () => {
    fake.client.signInWithGoogle.mockRejectedValueOnce(firebaseError("auth/popup-closed-by-user"));

    await store.getState().signInWithGoogle();

    expect(store.getState().error).toBeNull();
  });

  it("confirme l'envoi du lien de réinitialisation sans dire si le compte existe", async () => {
    await store.getState().sendPasswordReset("inconnu@test.local");

    expect(store.getState()).toMatchObject({ notice: RESET_NOTICE, error: null });
  });

  it("passe à l'éditeur quand l'adresse a été vérifiée entre-temps", async () => {
    fake.emit(unverified);

    await store.getState().checkVerification();

    expect(store.getState()).toMatchObject({ status: "signedIn", error: null });
  });

  it("reste sur l'écran de vérification si l'adresse ne l'est toujours pas", async () => {
    fake.emit(unverified);
    fake.client.reload.mockResolvedValueOnce(unverified);

    await store.getState().checkVerification();

    expect(store.getState()).toMatchObject({ status: "unverified", error: NOT_VERIFIED_YET });
  });

  it("déconnecte et explique pourquoi quand l'API refuse la session", async () => {
    fake.emit(verified);

    await store.getState().sessionRejected();

    expect(store.getState()).toMatchObject({ status: "signedOut", error: SESSION_REJECTED });
  });
});

describe("authErrorMessage", () => {
  it("donne un message générique pour une erreur inconnue", () => {
    expect(authErrorMessage(new Error("boom"))).toBe("La connexion a échoué. Réessayez.");
    expect(authErrorMessage(firebaseError("auth/inconnue"))).toBe(
      "La connexion a échoué. Réessayez.",
    );
  });
});
