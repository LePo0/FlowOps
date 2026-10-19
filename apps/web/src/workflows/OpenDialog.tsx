import type { WorkflowSummary } from "@flowops/shared";
import { useEffect, useRef, useState } from "react";
import { useDocumentStore, workflowsApi } from "./use-document.ts";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workflows: WorkflowSummary[] };

// Fenêtre « Ouvrir » : liste des workflows enregistrés, ouverture et suppression
export function OpenDialog({
  canDiscard,
  onClose,
}: {
  canDiscard: () => boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentId = useDocumentStore((state) => state.id);

  // Fenêtre modale native : Échap et focus gérés par le navigateur
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    void workflowsApi
      .list()
      .then((result) =>
        setList(
          result.ok
            ? { status: "ready", workflows: result.data }
            : { status: "error", message: result.message },
        ),
      );
  }, []);

  const open = async (id: string) => {
    if (!canDiscard()) return;
    if (await useDocumentStore.getState().open(id)) onClose();
  };

  const remove = async (id: string) => {
    const result = await workflowsApi.remove(id);
    setConfirmingDelete(null);
    if (!result.ok) {
      setDeleteError(`Suppression impossible : ${result.message}`);
      return;
    }
    setDeleteError(null);
    useDocumentStore.getState().forget(id);
    setList((current) =>
      current.status === "ready"
        ? { ...current, workflows: current.workflows.filter((workflow) => workflow.id !== id) }
        : current,
    );
  };

  return (
    <dialog
      ref={dialog}
      className="open-dialog"
      aria-labelledby="open-dialog-title"
      onClose={onClose}
    >
      <header className="open-dialog__header">
        <h2 id="open-dialog-title" className="open-dialog__title">
          Ouvrir un workflow
        </h2>
        <button type="button" className="button" onClick={() => dialog.current?.close()}>
          Fermer
        </button>
      </header>

      {list.status === "loading" && <p className="open-dialog__note">Chargement…</p>}
      {list.status === "error" && <p className="open-dialog__error">{list.message}</p>}
      {list.status === "ready" && list.workflows.length === 0 && (
        <p className="open-dialog__note">Aucun workflow enregistré pour l'instant.</p>
      )}
      {deleteError !== null && <p className="open-dialog__error">{deleteError}</p>}

      {list.status === "ready" && list.workflows.length > 0 && (
        <ul className="open-dialog__list">
          {list.workflows.map((workflow) => (
            <li key={workflow.id} className="open-dialog__item">
              <button
                type="button"
                className="open-dialog__open"
                onClick={() => void open(workflow.id)}
              >
                <span className="open-dialog__name">
                  {workflow.name}
                  {workflow.id === currentId && (
                    <span className="open-dialog__current"> (ouvert)</span>
                  )}
                </span>
                <span className="open-dialog__date">
                  Modifié le {dateFormat.format(new Date(workflow.updatedAt))}
                </span>
              </button>
              {confirmingDelete === workflow.id ? (
                <span className="open-dialog__confirm">
                  Supprimer ?
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => void remove(workflow.id)}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setConfirmingDelete(null)}
                  >
                    Non
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="button"
                  aria-label={`Supprimer ${workflow.name}`}
                  onClick={() => setConfirmingDelete(workflow.id)}
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
