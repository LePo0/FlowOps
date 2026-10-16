import type { ConditionNode, NodeStatus, NodeType } from "@flowops/shared";

type Operator = ConditionNode["config"]["operator"];

export const TYPE_LABELS: Record<NodeType, string> = {
  trigger: "Déclencheur",
  http: "Requête HTTP",
  condition: "Condition",
  transform: "Transformation",
};

export const STATUS_LABELS: Record<NodeStatus, string> = {
  SUCCESS: "Réussi",
  FAILED: "Échec",
  SKIPPED: "Ignoré",
};

// Exemple de référence vers la sortie d'un nœud, selon ce que produit son handler
export function referenceExample(id: string, type: NodeType): string | null {
  switch (type) {
    case "trigger":
      return null;
    case "http":
      return `${id}.status, ${id}.body`;
    case "condition":
      return `${id}.result`;
    case "transform":
      return id;
  }
}

// Forme courte, affichée sur le nœud
export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  contains: "contient",
  exists: "existe",
};

// Forme longue, affichée dans le panneau de configuration
export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "est égal à",
  neq: "est différent de",
  gt: "est supérieur à",
  lt: "est inférieur à",
  contains: "contient",
  exists: "existe",
};
