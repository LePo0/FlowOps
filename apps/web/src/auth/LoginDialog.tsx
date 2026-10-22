import { useEffect, useRef } from "react";
import type { LoginMode } from "./auth-store.ts";
import { LoginScreen } from "./LoginScreen.tsx";
import { useAuthStore } from "./session.ts";

// Connexion ou création de compte depuis une session de démo : l'éditeur reste monté dessous,
// un workflow en cours n'est pas perdu si le visiteur revient à la démo
export function LoginDialog({ mode }: { mode: LoginMode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Fenêtre modale native : Échap et focus gérés par le navigateur
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="login-dialog"
      aria-labelledby="auth-title"
      onClose={() => useAuthStore.getState().closeLogin()}
    >
      <LoginScreen key={mode} initialMode={mode} onClose={() => dialog.current?.close()} />
    </dialog>
  );
}
