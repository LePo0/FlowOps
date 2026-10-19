import type { ConditionNode, HttpNode, TransformNode, WorkflowNode } from "@flowops/shared";
import { compare } from "./compare.js";
import { describeFetchError } from "./http-errors.js";
import { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_BYTES, deadlineMessage } from "./limits.js";
import { TargetDeniedError } from "./network/guarded-fetch.js";
import { SENSITIVE_HEADER } from "./network/sensitive-header.js";
import { NodeError } from "./node-error.js";
import { resolveReference } from "./resolve-reference.js";
import { interpolate } from "./template.js";
import { applyTransform } from "./transform.js";
import type { HandlerContext, HandlerResult } from "./types.js";

class ResponseTooLargeError extends Error {}

/**
 * Lit le corps en flux et s'arrête dès que MAX_RESPONSE_BYTES est dépassé : une réponse de
 * plusieurs Go ne passe jamais en mémoire. La taille annoncée (Content-Length) permet de refuser
 * sans rien lire, mais elle peut mentir : seuls les octets reçus font foi.
 */
async function readLimited(response: Response, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new ResponseTooLargeError();
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  // Le délai couvre la lecture, même si le fetch ne propage pas lui-même le signal au corps
  const onAbort = () => void reader.cancel(signal.reason).catch(() => {});
  signal.addEventListener("abort", onAbort, { once: true });
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      // Une lecture interrompue par l'annulation se termine « done » : ce n'est pas la fin du corps
      if (signal.aborted) throw signal.reason;
      if (done) return text + decoder.decode();
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new ResponseTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

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
  // Délai du nœud ou échéance globale de l'exécution, le premier atteint
  const signal = AbortSignal.any([AbortSignal.timeout(timeout), ctx.deadline]);
  try {
    response = await ctx.fetch(url, { method, headers, body, signal });
    text = await readLimited(response, signal);
  } catch (error) {
    // Cible refusée : message unique et aucune cause jointe (ni adresse, ni erreur réseau)
    if (error instanceof TargetDeniedError) throw new NodeError(error.message, { input });
    if (error instanceof ResponseTooLargeError) {
      throw new NodeError("Réponse trop volumineuse", { input });
    }
    if (ctx.deadline.aborted) throw new NodeError(deadlineMessage(ctx.maxDurationMs), { input });

    let message = describeFetchError(error, timeout);
    // Erreur fréquente : une référence écrite sans accolades (http1.body.url)
    const firstSegment = url.split(".")[0];
    if (message === "URL invalide" && firstSegment !== undefined && ctx.outputs.has(firstSegment)) {
      message = `URL invalide. Pour utiliser une valeur d'un nœud, écrivez {{${url}}}`;
    }
    throw new NodeError(message, { input, cause: error });
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
