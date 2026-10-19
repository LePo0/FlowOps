import { AuthCard } from "./AuthCard.tsx";
import { useAuthStore } from "./session.ts";

// Compte email/mot de passe pas encore vérifié : l'API refuserait ses requêtes (403)
export function VerifyEmailScreen() {
  const email = useAuthStore((state) => state.user?.email);
  const busy = useAuthStore((state) => state.busy);
  const auth = () => useAuthStore.getState();

  return (
    <AuthCard title="Vérifiez votre adresse email">
      <p>
        Un lien de vérification a été envoyé à <strong>{email}</strong>. Ouvrez-le, puis revenez
        ici.
      </p>
      <div className="auth__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={busy}
          onClick={() => void auth().checkVerification()}
        >
          J'ai vérifié mon adresse
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void auth().resendVerification()}
        >
          Renvoyer le lien
        </button>
        <button
          type="button"
          className="auth__link"
          disabled={busy}
          onClick={() => void auth().signOut()}
        >
          Se déconnecter
        </button>
      </div>
    </AuthCard>
  );
}
