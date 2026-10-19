import type { RunDetail, RunSummary } from "@flowops/shared";
import { useEffect, useRef } from "react";
import { STATUS_LABELS, TYPE_LABELS } from "../editor/labels.ts";
import { NodeResultView } from "../run/NodeResultView.tsx";
import { useHistoryStore } from "./use-history.ts";
import "./history.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

// Fenêtre « Historique » d'un workflow enregistré : exécutions passées, détail par nœud, relance
export function HistoryDialog({
  workflowId,
  workflowName,
  onClose,
}: {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const runs = useHistoryStore((state) => state.runs);
  const selectedId = useHistoryStore((state) => state.selectedId);
  const detail = useHistoryStore((state) => state.detail);

  // Fenêtre modale native : Échap et focus gérés par le navigateur
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    void useHistoryStore.getState().open(workflowId);
  }, [workflowId]);

  return (
    <dialog
      ref={dialog}
      className="history-dialog"
      aria-labelledby="history-dialog-title"
      onClose={onClose}
    >
      <header className="history-dialog__header">
        <h2 id="history-dialog-title" className="history-dialog__title">
          Historique · {workflowName}
        </h2>
        <button type="button" className="button" onClick={() => dialog.current?.close()}>
          Fermer
        </button>
      </header>

      <div className="history-dialog__body">
        <nav className="history-dialog__runs" aria-label="Exécutions">
          {runs.status === "loading" && <p className="history-dialog__note">Chargement…</p>}
          {runs.status === "error" && <p className="history-dialog__error">{runs.message}</p>}
          {runs.status === "ready" && runs.data.length === 0 && (
            <p className="history-dialog__note">
              Aucune exécution pour l'instant : cliquez sur « Exécuter » pour en lancer une.
            </p>
          )}
          {runs.status === "ready" && runs.data.length > 0 && (
            <ul className="history-dialog__list">
              {runs.data.map((run) => (
                <RunItem key={run.id} run={run} selected={run.id === selectedId} />
              ))}
            </ul>
          )}
        </nav>

        <div className="history-dialog__detail">
          {detail.status === "loading" && <p className="history-dialog__note">Chargement…</p>}
          {detail.status === "error" && <p className="history-dialog__error">{detail.message}</p>}
          {detail.status === "ready" && <RunDetailView run={detail.data} />}
        </div>
      </div>
    </dialog>
  );
}

function RunItem({ run, selected }: { run: RunSummary; selected: boolean }) {
  return (
    <li>
      <button
        type="button"
        className={`history-dialog__run${selected ? " history-dialog__run--selected" : ""}`}
        aria-current={selected}
        onClick={() => void useHistoryStore.getState().select(run.id)}
      >
        <span className={`history-dialog__status history-dialog__status--${run.status}`}>
          {STATUS_LABELS[run.status]}
        </span>
        <span className="history-dialog__date">{formatDate(run.startedAt)}</span>
        <span className="history-dialog__duration">{run.durationMs} ms</span>
      </button>
    </li>
  );
}

function RunDetailView({ run }: { run: RunDetail }) {
  const replaying = useHistoryStore((state) => state.replaying);
  const replayError = useHistoryStore((state) => state.replayError);
  // Noms et types tirés de la copie du graphe : le workflow a pu changer depuis
  const nodeById = new Map(run.graph.nodes.map((node) => [node.id, node]));

  return (
    <article className="history-run" aria-label="Détail de l'exécution">
      <header className="history-run__header">
        <div>
          <p className={`history-dialog__status history-dialog__status--${run.status}`}>
            {STATUS_LABELS[run.status]} · {run.durationMs} ms
          </p>
          <p className="history-dialog__note">Lancée le {formatDate(run.startedAt)}</p>
        </div>
        <div className="history-run__replay">
          <button
            type="button"
            className="button button--primary"
            disabled={replaying}
            onClick={() => void useHistoryStore.getState().replay()}
          >
            {replaying ? "Relance…" : "Relancer"}
          </button>
          <p className="history-dialog__note">
            Rejoue le workflow tel qu'il était lors de cette exécution, même s'il a été modifié
            depuis.
          </p>
        </div>
      </header>
      {replayError !== null && (
        <p className="history-dialog__error" role="alert">
          {replayError}
        </p>
      )}

      <ol className="history-run__nodes">
        {run.nodeResults.map((result) => {
          const node = nodeById.get(result.nodeId);
          const title = node ? `${node.name} · ${TYPE_LABELS[node.type]}` : `Nœud ${result.nodeId}`;
          return (
            <li key={result.nodeId}>
              <NodeResultView result={result} title={title} />
            </li>
          );
        })}
      </ol>
    </article>
  );
}
