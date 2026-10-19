import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { HistoryDialog } from "../history/HistoryDialog.tsx";
import { UNTITLED } from "./document-store.ts";
import { OpenDialog } from "./OpenDialog.tsx";
import { blankWorkflow, useDocumentStore, useIsDirty } from "./use-document.ts";
import "./workflows.css";

const DISCARD_MESSAGE = "Les modifications non enregistrées seront perdues. Continuer ?";

// Nom du workflow, enregistrement et ouverture, dans l'en-tête
export function DocumentBar() {
  const { id, name, busy, error, setName, save, newDocument } = useDocumentStore(
    useShallow((state) => ({
      id: state.id,
      name: state.name,
      busy: state.busy,
      error: state.error,
      setName: state.setName,
      save: state.save,
      newDocument: state.newDocument,
    })),
  );
  const dirty = useIsDirty();
  const [openDialog, setOpenDialog] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Au chargement de la page : rouvre le dernier workflow ouvert
  useEffect(() => {
    void useDocumentStore.getState().restoreLast();
  }, []);

  // Ctrl+S (ou Cmd+S) enregistre au lieu d'enregistrer la page HTML
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void useDocumentStore.getState().save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fermer l'onglet avec des modifications non enregistrées : le navigateur demande confirmation
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const canDiscard = () => !dirty || window.confirm(DISCARD_MESSAGE);

  const status =
    busy === "saving"
      ? "Enregistrement…"
      : busy === "loading"
        ? "Ouverture…"
        : id === null
          ? "Non enregistré"
          : dirty
            ? "Modifications non enregistrées"
            : "Enregistré";

  return (
    <div className="document-bar">
      <input
        className="document-bar__name"
        value={name}
        placeholder="Sans titre"
        maxLength={100}
        aria-label="Nom du workflow"
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        className="button"
        disabled={busy !== null}
        onClick={() => void save()}
        title="Enregistrer (Ctrl+S)"
      >
        Enregistrer
      </button>
      <button type="button" className="button" onClick={() => setOpenDialog(true)}>
        Ouvrir…
      </button>
      <button
        type="button"
        className="button"
        onClick={() => canDiscard() && newDocument(blankWorkflow)}
      >
        Nouveau
      </button>
      <button
        type="button"
        className="button"
        disabled={id === null}
        title={
          id === null
            ? "Enregistrez le workflow pour garder l'historique de ses exécutions"
            : undefined
        }
        onClick={() => setHistoryOpen(true)}
      >
        Historique
      </button>
      <span
        className={`document-bar__status${dirty ? " document-bar__status--dirty" : ""}`}
        role="status"
      >
        {status}
      </span>
      {error !== null && (
        <p className="document-bar__error" role="alert">
          {error}
        </p>
      )}
      {openDialog && <OpenDialog canDiscard={canDiscard} onClose={() => setOpenDialog(false)} />}
      {historyOpen && id !== null && (
        <HistoryDialog
          workflowId={id}
          workflowName={name.trim() || UNTITLED}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
