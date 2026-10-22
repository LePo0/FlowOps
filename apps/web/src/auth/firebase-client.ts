import { initializeApp, type FirebaseError, type FirebaseOptions } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import type { AuthClient, AuthUser } from "./auth-client.ts";

const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  name: user.displayName,
  emailVerified: user.emailVerified,
  anonymous: user.isAnonymous,
});

const hasCode = (error: unknown, code: string) =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

export function createFirebaseAuthClient(
  options: FirebaseOptions,
  emulatorHost?: string,
): AuthClient {
  const auth = getAuth(initializeApp(options));
  // Les jetons de l'émulateur ne sont pas signés : l'API ne les accepte qu'en test
  if (emulatorHost !== undefined) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  }
  // Langue des emails de vérification et de réinitialisation, et de la fenêtre Google
  auth.languageCode = "fr";

  const currentUser = () => {
    if (!auth.currentUser) throw new Error("Aucune session en cours");
    return auth.currentUser;
  };

  // Après une liaison, le jeton en cache dit encore « anonyme » : l'API garderait les quotas de démo
  const linked = async (user: User) => {
    await user.getIdToken(true);
    return toAuthUser(user);
  };

  return {
    onChange: (listener) => onAuthStateChanged(auth, (user) => listener(user && toAuthUser(user))),

    signInAnonymously: async () => {
      await signInAnonymously(auth);
    },

    signInWithGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },

    signInWithPassword: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },

    signUp: async (email, password) => {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(user);
    },

    linkWithGoogle: async () => {
      try {
        const { user } = await linkWithPopup(currentUser(), new GoogleAuthProvider());
        return await linked(user);
      } catch (error) {
        // Compte Google déjà connu : on s'y connecte, la session de démo est abandonnée (U3)
        const credential = hasCode(error, "auth/credential-already-in-use")
          ? GoogleAuthProvider.credentialFromError(error as FirebaseError)
          : null;
        if (!credential) throw error;
        await signInWithCredential(auth, credential);
        return null;
      }
    },

    linkWithPassword: async (email, password) => {
      const { user } = await linkWithCredential(
        currentUser(),
        EmailAuthProvider.credential(email, password),
      );
      await sendEmailVerification(user);
      return linked(user);
    },

    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),

    sendVerification: async () => {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    },

    reload: async () => {
      const user = auth.currentUser;
      if (!user) return null;
      await user.reload();
      // Le jeton en cache porte encore email_verified=false : l'API le refuserait
      await user.getIdToken(true);
      return toAuthUser(user);
    },

    signOut: () => signOut(auth),

    getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  };
}
