import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthClient, AuthUser } from "./auth-client.ts";
import { authErrorMessage } from "./auth-errors.ts";
import {
  createAuthStore,
  DEMO_UNAVAILABLE,
  NOT_VERIFIED_YET,
  RESET_NOTICE,
  SESSION_REJECTED,
} from "./auth-store.ts";

const verified: AuthUser = {
  uid: "uid-alice",
  email: "alice@test.local",
  name: "Alice",
  emailVerified: true,
  anonymous: false,
};
const unverified: AuthUser = { ...verified, emailVerified: false };
// Session de démo : compte anonyme Firebase, sans email
const visitor: AuthUser = {
  uid: "uid-visiteur",
  email: null,
  name: null,
  emailVerified: false,
  anonymous: true,
};
const firebaseError = (code: string) => Object.assign(new Error(code), { code });

// Double du client Firebase : `emit` simule un changement de session. Comme Firebase, une
// session de démo ouverte avec signInAnonymously est annoncée par onChange.
function fakeClient() {
  let listener: (user: AuthUser | null) => void = () => {};
  const client = {
    onChange: vi.fn((next: typeof listener) => {
      listener = next;
      return () => {};
    }),
    signInAnonymously: vi.fn(async () => listener(visitor)),
    signInWithGoogle: vi.fn(async () => {}),
    signInWithPassword: vi.fn(async () => {}),
    signUp: vi.fn(async () => {}),
    // Même uid que la session de démo : c'est le même compte, devenu permanent
    linkWithGoogle: vi.fn(async (): Promise<AuthUser | null> => ({
      ...verified,
      uid: visitor.uid,
    })),
    linkWithPassword: vi.fn(async (email: string): Promise<AuthUser> => ({
      ...unverified,
      uid: visitor.uid,
      email,
    })),
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

    fake.emit(verified);
    expect(store.getState()).toMatchObject({ status: "signedIn", user: verified });
  });

  it("A1 : sans session, ouvre une session de démo sans clic", async () => {
    fake.emit(null);

    await vi.waitFor(() => expect(store.getState().status).toBe("demo"));
    expect(fake.client.signInAnonymously).toHaveBeenCalledOnce();
    expect(store.getState().user).toEqual(visitor);
  });

  it("garde l'écran de connexion seul si Firebase refuse les sessions de démo", async () => {
    fake.client.signInAnonymously.mockRejectedValueOnce(
      firebaseError("auth/admin-restricted-operation"),
    );

    fake.emit(null);

    await vi.waitFor(() => expect(store.getState().status).toBe("signedOut"));
    // Pas de nouvelle tentative à chaque changement de session
    fake.emit(null);
    expect(fake.client.signInAnonymously).toHaveBeenCalledOnce();
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

  it("ferme la session et explique pourquoi quand l'API la refuse", async () => {
    fake.emit(verified);

    await store.getState().sessionRejected();

    expect(fake.client.signOut).toHaveBeenCalled();
    expect(store.getState().error).toBe(SESSION_REJECTED);
    await vi.waitFor(() => expect(store.getState().status).toBe("demo"));
  });

  it("U4 : après la déconnexion d'un vrai compte, nouvelle session de démo", async () => {
    fake.emit(verified);

    await store.getState().signOut();

    await vi.waitFor(() => expect(store.getState().user).toEqual(visitor));
  });
});

describe("store d'authentification : session de démo", () => {
  let fake: ReturnType<typeof fakeClient>;
  let store: ReturnType<typeof createAuthStore>;

  beforeEach(() => {
    fake = fakeClient();
    store = createAuthStore(() => fake.client);
    store.getState().start();
    fake.emit(visitor);
  });

  it("ouvre et ferme l'écran de connexion par-dessus l'éditeur", () => {
    store.getState().openLogin("signUp");
    expect(store.getState()).toMatchObject({ status: "demo", login: "signUp" });

    store.getState().closeLogin();
    expect(store.getState().login).toBeNull();
  });

  it("U1 : créer un compte lie la session (même uid), puis attend la vérification", async () => {
    store.getState().openLogin("signUp");

    await store.getState().signUp(" visiteur@test.local ", "secret123");

    expect(fake.client.linkWithPassword).toHaveBeenCalledWith("visiteur@test.local", "secret123");
    expect(fake.client.signUp).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      status: "unverified",
      login: null,
      user: { uid: visitor.uid, email: "visiteur@test.local" },
    });
  });

  it("U1 : Google lie la session et ouvre l'éditeur avec le même compte", async () => {
    await store.getState().signInWithGoogle();

    expect(fake.client.linkWithGoogle).toHaveBeenCalledOnce();
    expect(fake.client.signInWithGoogle).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: "signedIn", user: { uid: visitor.uid } });
  });

  it("U3 : compte Google déjà existant, la connexion suit le changement de compte", async () => {
    fake.client.linkWithGoogle.mockImplementationOnce(async () => {
      fake.emit(verified);
      return null;
    });

    await store.getState().signInWithGoogle();

    expect(store.getState()).toMatchObject({ status: "signedIn", user: verified, login: null });
  });

  it("explique qu'une adresse a déjà un compte", async () => {
    fake.client.linkWithPassword.mockRejectedValueOnce(firebaseError("auth/email-already-in-use"));

    await store.getState().signUp("alice@test.local", "secret123");

    expect(store.getState().status).toBe("demo");
    expect(store.getState().error).toMatch(/existe déjà/);
  });

  it("se connecter à un compte existant quitte la session de démo", async () => {
    store.getState().openLogin("signIn");
    fake.client.signInWithPassword.mockImplementationOnce(async () => fake.emit(verified));

    await store.getState().signInWithPassword("alice@test.local", "secret");

    expect(store.getState()).toMatchObject({ status: "signedIn", user: verified, login: null });
  });

  it("A4 : l'API refuse les sessions de démo, il ne reste que la connexion", async () => {
    await store.getState().demoRefused();

    expect(store.getState()).toMatchObject({
      status: "signedOut",
      demoUnavailable: true,
      error: DEMO_UNAVAILABLE,
    });
    expect(fake.client.signInAnonymously).not.toHaveBeenCalled();
  });

  it("ignore un refus des sessions de démo arrivé après le passage à un vrai compte", async () => {
    fake.emit(verified);

    await store.getState().demoRefused();

    expect(store.getState()).toMatchObject({ status: "signedIn", demoUnavailable: false });
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
