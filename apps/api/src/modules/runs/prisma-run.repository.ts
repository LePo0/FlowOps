import { MAX_RUNS_PER_WORKFLOW, WorkflowGraphSchema, type NodeResult } from "@flowops/shared";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { RunRepository, StoredRun } from "./run.repository.js";

const summaryFields = {
  id: true,
  workflowId: true,
  status: true,
  startedAt: true,
  durationMs: true,
} as const;

// Colonne JSON facultative : absent → NULL SQL, null → null JSON, sinon la valeur telle quelle
function toJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

type RunRow = Prisma.WorkflowRunGetPayload<{ include: { nodeRuns: true } }>;

function toStored(row: RunRow): StoredRun {
  const { graphJson, nodeRuns, ...summary } = row;
  return {
    id: summary.id,
    workflowId: summary.workflowId,
    status: summary.status,
    startedAt: summary.startedAt,
    durationMs: summary.durationMs,
    // Revalidé à la lecture, comme pour les workflows
    graph: WorkflowGraphSchema.parse(graphJson),
    nodeResults: nodeRuns
      .sort((a, b) => a.position - b.position)
      .map((nodeRun): NodeResult => ({
        nodeId: nodeRun.nodeId,
        status: nodeRun.status,
        ...(nodeRun.input !== null && { input: nodeRun.input }),
        ...(nodeRun.output !== null && { output: nodeRun.output }),
        ...(nodeRun.error !== null && { error: nodeRun.error }),
        ...(nodeRun.errorDetail !== null && { errorDetail: nodeRun.errorDetail }),
        durationMs: nodeRun.durationMs,
      })),
  };
}

export function createPrismaRunRepository(prisma: PrismaClient): RunRepository {
  const ownsWorkflow = async (tx: Prisma.TransactionClient, userId: string, id: string) =>
    (await tx.workflow.count({ where: { id, userId } })) > 0;

  return {
    // Une seule transaction : vérification du propriétaire, écriture, puis purge des plus anciennes
    record: (userId, workflowId, run) =>
      prisma.$transaction(async (tx) => {
        if (!(await ownsWorkflow(tx, userId, workflowId))) return null;

        const created = await tx.workflowRun.create({
          data: {
            workflowId,
            status: run.status,
            startedAt: run.startedAt,
            durationMs: run.durationMs,
            graphJson: run.graph as unknown as Prisma.InputJsonValue,
            nodeRuns: {
              create: run.nodeResults.map((result, position) => ({
                position,
                nodeId: result.nodeId,
                status: result.status,
                input: toJson(result.input),
                output: toJson(result.output),
                error: result.error,
                errorDetail: result.errorDetail,
                durationMs: result.durationMs,
              })),
            },
          },
          include: { nodeRuns: true },
        });

        const beyondLimit = await tx.workflowRun.findMany({
          where: { workflowId },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          skip: MAX_RUNS_PER_WORKFLOW,
          select: { id: true },
        });
        if (beyondLimit.length > 0) {
          // Les NodeRun suivent par cascade
          await tx.workflowRun.deleteMany({ where: { id: { in: beyondLimit.map((r) => r.id) } } });
        }

        return toStored(created);
      }),

    list: async (userId, workflowId) => {
      if (!(await ownsWorkflow(prisma, userId, workflowId))) return null;
      return prisma.workflowRun.findMany({
        where: { workflowId },
        select: summaryFields,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      });
    },

    find: async (userId, runId) => {
      const row = await prisma.workflowRun.findFirst({
        where: { id: runId, workflow: { userId } },
        include: { nodeRuns: true },
      });
      return row ? toStored(row) : null;
    },
  };
}
