import { NodeResultView } from "./NodeResultView.tsx";
import { useRunStore } from "./run-store.ts";

// Résultat de la dernière exécution pour un nœud, affiché dans le panneau
export function NodeRunResult({ nodeId }: { nodeId: string }) {
  const result = useRunStore((state) => state.resultsByNode[nodeId]);
  if (!result) return null;
  return <NodeResultView result={result} title="Dernière exécution" />;
}
