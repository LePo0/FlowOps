import type { NodeResult } from "@flowops/shared";
import { STATUS_LABELS } from "../editor/labels.ts";
import "./run.css";

// Au-delà, le texte est tronqué : une réponse HTTP peut faire jusqu'à 1 Mo
const MAX_CHARS = 5_000;

function formatJson(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? String(value);
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS)}\n… (tronqué, ${text.length} caractères)`
    : text;
}

// Résultat d'un nœud : statut, durée, erreur, sortie et détails (entrée utilisée, erreur technique)
export function NodeResultView({ result, title }: { result: NodeResult; title: string }) {
  const hasDetails = result.input !== undefined || result.errorDetail !== undefined;
  // Déplié d'office en cas d'échec : c'est là qu'on cherche ce qui s'est passé
  const failed = result.status === "FAILED";

  return (
    <section className="run-result" aria-label={title}>
      <h3 className="run-result__title">{title}</h3>
      <p className={`run-result__status run-result__status--${result.status}`}>
        {STATUS_LABELS[result.status]}
        {result.status !== "SKIPPED" && ` · ${result.durationMs} ms`}
      </p>
      {result.error !== undefined && <p className="run-result__error">{result.error}</p>}
      {result.output !== undefined && (
        <pre className="run-result__output">{formatJson(result.output)}</pre>
      )}
      {hasDetails && (
        <details className="run-result__details" open={failed}>
          <summary>Détails</summary>
          {result.input !== undefined && (
            <>
              <h4 className="run-result__subtitle">Entrée utilisée</h4>
              <pre className="run-result__output">{formatJson(result.input)}</pre>
            </>
          )}
          {result.errorDetail !== undefined && (
            <>
              <h4 className="run-result__subtitle">Erreur technique</h4>
              <pre className="run-result__output">{result.errorDetail}</pre>
            </>
          )}
        </details>
      )}
    </section>
  );
}
