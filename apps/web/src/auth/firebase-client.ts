import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import type { AuthClient, AuthUser } from "./auth-client.ts";

const toAuthUser = (user: User): AuthUser => ({
  email: user.email,
  name: user.displayName,
  emailVerified: user.emailVerified,
});

export function createFirebaseAuthClient(options: FirebaseOptions): AuthClient {
  const auth = getAuth(initializeApp(options));
  // Langue des emails de vérification et de réinitialisation, et de la fenêtre Google
  auth.languageCode = "fr";

  return {
    onChange: (listener) => onAuthStateChanged(auth, (user) => listener(user && toAuthUser(user))),

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
