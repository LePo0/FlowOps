import { topologicalSort, WorkflowGraphSchema, type WorkflowNode } from "@flowops/shared";
import type { ValidationError, ValidationResult } from "./types.js";

export function validateGraph(input: unknown): ValidationResult {
  // 1. Forme : types, champs, limites
  const parsed = WorkflowGraphSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        code: "INVALID_SHAPE" as const,
        message: `${issue.path.map(String).join(".") || "graphe"} : ${issue.message}`,
      })),
    };
  }

  const graph = parsed.data;
  const errors: ValidationError[] = [];

  // 2. Identifiants de nœuds uniques
  const nodeById = new Map<string, WorkflowNode>();
  for (const node of graph.nodes) {
    if (nodeById.has(node.id)) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        message: `Identifiant de nœud en double : ${node.id}`,
        nodeId: node.id,
      });
    } else {
      nodeById.set(node.id, node);
    }
  }

  // 3. Un seul déclencheur
  const triggerCount = graph.nodes.filter((node) => node.type === "trigger").length;
  if (triggerCount !== 1) {
    errors.push({
      code: "TRIGGER_COUNT",
      message: `Le workflow doit contenir exactement un déclencheur (trouvé : ${triggerCount})`,
    });
  }

  // 4. Arêtes : nœuds existants, déclencheur sans entrée, branches cohérentes
  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);

    if (!source || !target) {
      errors.push({
        code: "UNKNOWN_NODE",
        message: `L'arête ${edge.id} référence un nœud inexistant`,
        edgeId: edge.id,
      });
      continue;
    }
    if (target.type === "trigger") {
      errors.push({
        code: "TRIGGER_HAS_INCOMING_EDGE",
        message: `Le déclencheur ${target.id} ne peut pas avoir d'entrée`,
        edgeId: edge.id,
        nodeId: target.id,
      });
    }
    if (source.type === "condition" && edge.branch === undefined) {
      errors.push({
        code: "INVALID_BRANCH",
        message: `L'arête ${edge.id} part d'une condition sans branche (true ou false)`,
        edgeId: edge.id,
      });
    }
    if (source.type !== "condition" && edge.branch !== undefined) {
      errors.push({
        code: "INVALID_BRANCH",
        message: `L'arête ${edge.id} a une branche mais ne part pas d'une condition`,
        edgeId: edge.id,
      });
    }
  }

  // 5. Pas de cycle (seulement si le reste est cohérent, sinon le calcul n'a pas de sens)
  if (
    errors.length === 0 &&
    topologicalSort(
      graph.nodes.map((node) => node.id),
      graph.edges,
    ) === null
  ) {
    errors.push({ code: "CYCLE", message: "Le workflow contient un cycle" });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, graph };
}
