import { STATUS_LABELS } from "../editor/labels.ts";
import { useRunStore } from "./run-store.ts";

// Au-delà, la sortie est tronquée : une réponse HTTP peut faire jusqu'à 1 Mo
const MAX_OUTPUT_CHARS = 5_000;

function formatOutput(output: unknown): string {
  const text = JSON.stringify(output, null, 2) ?? String(output);
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (tronqué, ${text.length} caractères)`
    : text;
}

// Résultat de la dernière exécution pour un nœud, affiché dans le panneau
export function NodeRunResult({ nodeId }: { nodeId: string }) {
  const result = useRunStore((state) => state.resultsByNode[nodeId]);
  if (!result) return null;

  return (
    <section className="run-result" aria-label="Dernière exécution">
      <h3 className="run-result__title">Dernière exécution</h3>
      <p className={`run-result__status run-result__status--${result.status}`}>
        {STATUS_LABELS[result.status]}
        {result.status !== "SKIPPED" && ` · ${result.durationMs} ms`}
      </p>
      {result.error !== undefined && <p className="run-result__error">{result.error}</p>}
      {result.output !== undefined && (
        <pre className="run-result__output">{formatOutput(result.output)}</pre>
      )}
    </section>
  );
}
