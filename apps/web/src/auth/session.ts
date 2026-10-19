import { z } from "zod";
import type { AuthClient } from "./auth-client.ts";
import { createAuthFetch } from "./auth-fetch.ts";
import { createAuthStore } from "./auth-store.ts";
import { createFirebaseAuthClient } from "./firebase-client.ts";

// Configuration web du projet Firebase (apps/web/.env.local) : valeurs publiques
const FirebaseConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  appId: z.string().min(1),
});

const firebaseConfig = FirebaseConfigSchema.safeParse({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const authConfigured = firebaseConfig.success;

let client: AuthClient | null = null;
function authClient(): AuthClient {
  if (!firebaseConfig.success) throw new Error("Configuration Firebase absente");
  client ??= createFirebaseAuthClient(firebaseConfig.data);
  return client;
}

export const useAuthStore = createAuthStore(authClient);

// fetch de tous les appels à l'API
export const authFetch = createAuthFetch(
  () => (authConfigured ? authClient().getToken() : Promise.resolve(null)),
  () => void useAuthStore.getState().sessionRejected(),
);
