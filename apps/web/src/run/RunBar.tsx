import { useEditorStore } from "../editor/store.ts";
import type { RunOutcome } from "./api.ts";
import { useRunStore } from "./run-store.ts";
import "./run.css";

// Bouton « Exécuter » et résumé du dernier lancement, dans l'en-tête
export function RunBar() {
  const running = useRunStore((state) => state.running);
  const outcome = useRunStore((state) => state.outcome);
  const run = useRunStore((state) => state.run);

  const start = () => {
    const { nodes, edges } = useEditorStore.getState();
    void run(nodes, edges);
  };

  return (
    <div className="run-bar">
      <button type="button" className="button button--primary" disabled={running} onClick={start}>
        {running ? "Exécution…" : "Exécuter"}
      </button>
      <div className="run-bar__summary" role="status" aria-live="polite">
        {outcome && <RunSummary outcome={outcome} />}
      </div>
    </div>
  );
}

function RunSummary({ outcome }: { outcome: RunOutcome }) {
  const nodes = useEditorStore((state) => state.nodes);
  const selectNode = useEditorStore((state) => state.selectNode);
  const nameOf = (id: string) => nodes.find((node) => node.id === id)?.data.name ?? id;

  switch (outcome.kind) {
    case "executed": {
      const { status, durationMs, nodeResults } = outcome.result;
      if (status === "SUCCESS") {
        return (
          <span className="run-bar__badge run-bar__badge--success">Succès · {durationMs} ms</span>
        );
      }
      const failed = nodeResults.find((result) => result.status === "FAILED");
      return (
        <span className="run-bar__badge run-bar__badge--failed">
          Échec
          {failed && (
            <>
              {" sur "}
              <button
                type="button"
                className="run-bar__link"
                onClick={() => selectNode(failed.nodeId)}
              >
                {nameOf(failed.nodeId)}
              </button>
            </>
          )}{" "}
          · {durationMs} ms
        </span>
      );
    }
    case "rejected":
      return (
        <div className="run-bar__errors">
          <span className="run-bar__badge run-bar__badge--failed">Workflow non exécuté</span>
          <ul>
            {outcome.errors.map((error, index) => (
              <li key={index}>
                {error.nodeId !== undefined ? (
                  <button
                    type="button"
                    className="run-bar__link"
                    onClick={() => error.nodeId !== undefined && selectNode(error.nodeId)}
                  >
                    {error.message}
                  </button>
                ) : (
                  error.message
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    case "unavailable":
      return <span className="run-bar__badge run-bar__badge--failed">{outcome.message}</span>;
  }
}
