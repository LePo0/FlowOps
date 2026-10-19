import type { ReactNode } from "react";
import { useAuthStore } from "./session.ts";
import "./auth.css";

// Cadre commun des écrans hors éditeur : titre, contenu, messages du store d'authentification
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const error = useAuthStore((state) => state.error);
  const notice = useAuthStore((state) => state.notice);

  return (
    <main className="auth">
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
      </section>
    </main>
  );
}
