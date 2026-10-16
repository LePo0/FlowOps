import type { ConditionNode } from "@flowops/shared";

export type Operator = ConditionNode["config"]["operator"];
export type ComparedValue = ConditionNode["config"]["right"];

// Comparaison stricte (===), partagée par la condition et le filtre de la transformation
export function compare(left: unknown, operator: Operator, right: ComparedValue): boolean {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
    case "lt": {
      if (typeof left !== "number" || typeof right !== "number") {
        throw new Error(`L'opérateur ${operator} nécessite deux nombres`);
      }
      return operator === "gt" ? left > right : left < right;
    }
    case "contains":
      if (typeof left === "string" && typeof right === "string") return left.includes(right);
      if (Array.isArray(left)) return left.includes(right);
      return false;
    case "exists":
      return left !== undefined && left !== null;
  }
}
