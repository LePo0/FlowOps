import { useAuthStore } from "./session.ts";
import "./auth.css";

// Sous l'en-tête d'une session de démo : ce qu'elle garde, et comment le garder plus longtemps
export function DemoBanner() {
  return (
    <p className="demo-banner" role="note">
      <strong>Session de démo</strong> · vos workflows sont liés à ce navigateur et supprimés après
      7 jours sans visite.{" "}
      <button
        type="button"
        className="auth__link"
        onClick={() => useAuthStore.getState().openLogin("signUp")}
      >
        Créer un compte
      </button>{" "}
      pour les garder.
    </p>
  );
}
