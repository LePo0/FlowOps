import { useIsDirty } from "../workflows/use-document.ts";
import { useAuthStore } from "./session.ts";
import "./auth.css";

const DISCARD_MESSAGE =
  "Les modifications non enregistrées seront perdues à la déconnexion. Continuer ?";

// Compte connecté et déconnexion, dans l'en-tête de l'éditeur
export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const busy = useAuthStore((state) => state.busy);
  const dirty = useIsDirty();

  const signOut = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    void useAuthStore.getState().signOut();
  };

  return (
    <div className="user-menu">
      <span className="user-menu__email" title={user?.name ?? undefined}>
        {user?.email}
      </span>
      <button type="button" className="button" disabled={busy} onClick={signOut}>
        Se déconnecter
      </button>
    </div>
  );
}
