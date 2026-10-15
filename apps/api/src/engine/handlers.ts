import type { ConditionNode, HttpNode, TransformNode, WorkflowNode } from "@flowops/shared";
import { resolveReference } from "./resolve-reference.js";
import type { HandlerContext, HandlerResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_CHARS = 1_000_000;

async function runHttp(node: HttpNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { method, url, headers, body, timeoutMs } = node.config;

  const response = await ctx.fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : body,
    signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    throw new Error("Réponse trop volumineuse");
  }

  let parsedBody: unknown = text;
  if (response.headers.get("content-type")?.includes("json")) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      throw new Error("Réponse JSON invalide");
    }
  }

  // Un statut 4xx/5xx n'est pas une erreur du moteur : la condition décidera
  return { output: { status: response.status, ok: response.ok, body: parsedBody } };
}

function evaluate(
  left: unknown,
  operator: ConditionNode["config"]["operator"],
  right: string | number | boolean | undefined,
): boolean {
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

function runCondition(node: ConditionNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { left, operator, right } = node.config;
  const result = evaluate(resolveReference(left, ctx.outputs), operator, right);
  return Promise.resolve({ output: { result }, branch: result ? "true" : "false" });
}

function pickFields(item: unknown, fields: string[]): Record<string, unknown> {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("pick nécessite des objets");
  }
  const source = item as Record<string, unknown>;
  // fromEntries définit des propriétés propres : pas de risque avec "__proto__"
  return Object.fromEntries(
    fields.filter((field) => Object.hasOwn(source, field)).map((field) => [field, source[field]]),
  );
}

function runTransform(node: TransformNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { source, pick } = node.config;
  const value = resolveReference(source, ctx.outputs);

  if (pick === undefined) return Promise.resolve({ output: value });
  if (Array.isArray(value)) {
    return Promise.resolve({ output: value.map((item) => pickFields(item, pick)) });
  }
  return Promise.resolve({ output: pickFields(value, pick) });
}

export function runHandler(node: WorkflowNode, ctx: HandlerContext): Promise<HandlerResult> {
  switch (node.type) {
    case "trigger":
      return Promise.resolve({ output: {} });
    case "http":
      return runHttp(node, ctx);
    case "condition":
      return runCondition(node, ctx);
    case "transform":
      return runTransform(node, ctx);
  }
}
