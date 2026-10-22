import type { ReactNode } from "react";
import { useAuthStore } from "./session.ts";
import "./auth.css";

// Cadre commun des écrans hors éditeur : titre, contenu, messages du store d'authentification.
// Avec onClose, le cadre est affiché dans une fenêtre par-dessus l'éditeur (session de démo).
export function AuthCard({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const error = useAuthStore((state) => state.error);
  const notice = useAuthStore((state) => state.notice);

  const card = (
    <section className="auth__card" aria-labelledby="auth-title">
      <p className="auth__brand">FlowOps</p>
      <h1 id="auth-title" className="auth__title">
        {title}
      </h1>
      {children}
      {error && (
        <p className="auth__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth__notice" role="status">
          {notice}
        </p>
      )}
      {onClose && (
        <button type="button" className="auth__link auth__back" onClick={onClose}>
          Retour à la démo
        </button>
      )}
    </section>
  );

  return onClose ? card : <main className="auth">{card}</main>;
}
