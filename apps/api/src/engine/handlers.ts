import type { ConditionNode, HttpNode, TransformNode, WorkflowNode } from "@flowops/shared";
import { compare } from "./compare.js";
import { describeFetchError } from "./http-errors.js";
import { NodeError } from "./node-error.js";
import { resolveReference } from "./resolve-reference.js";
import { interpolate } from "./template.js";
import { applyTransform } from "./transform.js";
import type { HandlerContext, HandlerResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_CHARS = 1_000_000;

// En-têtes dont la valeur ne doit pas réapparaître dans le détail d'exécution
const SENSITIVE_HEADER = /authorization|cookie|token|secret|api[-_]?key/i;

function maskHeaders(headers: Record<string, string> | undefined) {
  if (headers === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SENSITIVE_HEADER.test(name) ? "***" : value,
    ]),
  );
}

async function runHttp(node: HttpNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { method, timeoutMs } = node.config;
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Les {{références}} sont résolues avant l'appel : l'entrée montre la requête réelle
  let url: string;
  let headers: Record<string, string> | undefined;
  let body: string | undefined;
  try {
    url = interpolate(node.config.url, ctx.outputs);
    headers =
      node.config.headers &&
      Object.fromEntries(
        Object.entries(node.config.headers).map(([name, value]) => [
          name,
          interpolate(value, ctx.outputs),
        ]),
      );
    body =
      method === "GET" || node.config.body === undefined
        ? undefined
        : interpolate(node.config.body, ctx.outputs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Pas de cause jointe : le message suffit, le détail le répéterait
    throw new NodeError(message, { input: { method, url: node.config.url } });
  }
  const input = { method, url, headers: maskHeaders(headers), body };

  let response: Response;
  let text: string;
  try {
    response = await ctx.fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });
    // La lecture du corps est couverte par le même délai
    text = await response.text();
  } catch (error) {
    let message = describeFetchError(error, timeout);
    // Erreur fréquente : une référence écrite sans accolades (http1.body.url)
    const firstSegment = url.split(".")[0];
    if (message === "URL invalide" && firstSegment !== undefined && ctx.outputs.has(firstSegment)) {
      message = `URL invalide. Pour utiliser une valeur d'un nœud, écrivez {{${url}}}`;
    }
    throw new NodeError(message, { input, cause: error });
  }

  if (text.length > MAX_RESPONSE_CHARS) {
    throw new NodeError("Réponse trop volumineuse", { input });
  }

  let parsedBody: unknown = text;
  if (response.headers.get("content-type")?.includes("json")) {
    try {
      parsedBody = JSON.parse(text);
    } catch (error) {
      throw new NodeError("Réponse JSON invalide", { input, cause: error });
    }
  }

  // Un statut 4xx/5xx n'est pas une erreur du moteur : la condition décidera
  return { input, output: { status: response.status, ok: response.ok, body: parsedBody } };
}

function runCondition(node: ConditionNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { left, operator, right } = node.config;
  const value = resolveReference(left, ctx.outputs);
  // null plutôt qu'undefined : la valeur reste visible une fois la réponse sérialisée en JSON
  const input = { value: value ?? null };

  let result: boolean;
  try {
    result = compare(value, operator, right);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeError(message, { input });
  }
  return Promise.resolve({ input, output: { result }, branch: result ? "true" : "false" });
}

function runTransform(node: TransformNode, ctx: HandlerContext): Promise<HandlerResult> {
  const { source, ...options } = node.config;
  return Promise.resolve(applyTransform(resolveReference(source, ctx.outputs), options));
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
