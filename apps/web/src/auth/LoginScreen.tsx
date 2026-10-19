import { useState, type FormEvent } from "react";
import { AuthCard } from "./AuthCard.tsx";
import { useAuthStore } from "./session.ts";

type Mode = "signIn" | "signUp" | "reset";

const TITLES: Record<Mode, string> = {
  signIn: "Connexion",
  signUp: "Créer un compte",
  reset: "Mot de passe oublié",
};
const SUBMIT: Record<Mode, string> = {
  signIn: "Se connecter",
  signUp: "Créer le compte",
  reset: "Envoyer le lien",
};

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const busy = useAuthStore((state) => state.busy);

  const switchTo = (next: Mode) => {
    setMode(next);
    useAuthStore.getState().clearMessages();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const auth = useAuthStore.getState();
    if (mode === "signIn") void auth.signInWithPassword(email, password);
    else if (mode === "signUp") void auth.signUp(email, password);
    else void auth.sendPasswordReset(email);
  };

  return (
    <AuthCard title={TITLES[mode]}>
      {mode !== "reset" && (
        <>
          <button
            type="button"
            className="button auth__google"
            disabled={busy}
            onClick={() => void useAuthStore.getState().signInWithGoogle()}
          >
            Continuer avec Google
          </button>
          <p className="auth__separator">ou</p>
        </>
      )}

      <form className="auth__form" onSubmit={submit}>
        <label className="auth__field">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode !== "reset" && (
          <label className="auth__field">
            Mot de passe
            <input
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              required
              minLength={mode === "signUp" ? 6 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {SUBMIT[mode]}
        </button>
      </form>

      <nav className="auth__links">
        {mode === "signIn" ? (
          <>
            <button type="button" className="auth__link" onClick={() => switchTo("signUp")}>
              Créer un compte
            </button>
            <button type="button" className="auth__link" onClick={() => switchTo("reset")}>
              Mot de passe oublié ?
            </button>
          </>
        ) : (
          <button type="button" className="auth__link" onClick={() => switchTo("signIn")}>
            J'ai déjà un compte
          </button>
        )}
      </nav>
    </AuthCard>
  );
}
