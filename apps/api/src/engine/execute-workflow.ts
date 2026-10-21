import { topologicalSort, type WorkflowEdge } from "@flowops/shared";
import { runHandler } from "./handlers.js";
import { NodeError, technicalDetail } from "./node-error.js";
import type { ExecutionDeps, ExecutionResult, HandlerContext, NodeResult } from "./types.js";
import { DEFAULT_MAX_DURATION_MS, MAX_RESPONSE_BYTES, deadlineMessage } from "./limits.js";
import { validateGraph } from "./validate-graph.js";

export async function executeWorkflow(
  input: unknown,
  deps: ExecutionDeps,
): Promise<ExecutionResult> {
  const validation = validateGraph(input);
  if (!validation.ok) return { status: "INVALID", errors: validation.errors };

  const { graph } = validation;
  const order = topologicalSort(
    graph.nodes.map((node) => node.id),
    graph.edges,
  );
  if (order === null) throw new Error("Cycle inattendu après validation");

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const edge of graph.edges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  const maxDurationMs = deps.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const ctx: HandlerContext = {
    outputs: new Map(),
    fetch: deps.fetch,
    deadline: AbortSignal.timeout(maxDurationMs),
    maxDurationMs,
    maxResponseBytes: deps.maxResponseBytes ?? MAX_RESPONSE_BYTES,
  };
  const succeeded = new Set<string>();
  const selectedBranch = new Map<string, "true" | "false">();
  const nodeResults: NodeResult[] = [];
  let failed = false;
  const runStart = performance.now();

  for (const id of order) {
    const node = nodeById.get(id);
    if (!node) continue;

    // Un nœud s'exécute s'il est le déclencheur ou si une arête entrante est active
    const isActive =
      node.type === "trigger" ||
      (incoming.get(id) ?? []).some(
        (edge) =>
          succeeded.has(edge.source) &&
          (edge.branch === undefined || selectedBranch.get(edge.source) === edge.branch),
      );

    if (failed || !isActive) {
      nodeResults.push({ nodeId: id, status: "SKIPPED", durationMs: 0 });
      continue;
    }

    const start = performance.now();
    // Échéance atteinte entre deux nœuds : celui-ci échoue, les suivants sont ignorés
    if (ctx.deadline.aborted) {
      failed = true;
      nodeResults.push({
        nodeId: id,
        status: "FAILED",
        error: deadlineMessage(maxDurationMs),
        durationMs: 0,
      });
      continue;
    }
    try {
      const result = await runHandler(node, ctx);
      ctx.outputs.set(id, result.output);
      succeeded.add(id);
      if (result.branch) selectedBranch.set(id, result.branch);
      nodeResults.push({
        nodeId: id,
        status: "SUCCESS",
        input: result.input,
        output: result.output,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (error) {
      failed = true;
      nodeResults.push({
        nodeId: id,
        status: "FAILED",
        input: error instanceof NodeError ? error.input : undefined,
        error: error instanceof Error ? error.message : String(error),
        errorDetail: technicalDetail(error),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  return {
    status: failed ? "FAILED" : "SUCCESS",
    nodeResults,
    durationMs: Math.round(performance.now() - runStart),
  };
}
