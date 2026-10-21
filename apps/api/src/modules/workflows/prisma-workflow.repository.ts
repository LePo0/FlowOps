import { WorkflowGraphSchema } from "@flowops/shared";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { StoredWorkflow, WorkflowRepository } from "./workflow.repository.js";

const summaryFields = { id: true, name: true, createdAt: true, updatedAt: true } as const;

function toStored(row: {
  id: string;
  name: string;
  graphJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): StoredWorkflow {
  const { graphJson, ...summary } = row;
  // Revalidé à la lecture : une donnée corrompue ou d'un ancien format échoue ici, pas plus loin
  return { ...summary, graph: WorkflowGraphSchema.parse(graphJson) };
}

// Le graphe a été validé par Zod : c'est du JSON pur
const toJson = (graph: StoredWorkflow["graph"]) => graph as unknown as Prisma.InputJsonValue;

export function createPrismaWorkflowRepository(prisma: PrismaClient): WorkflowRepository {
  const find = async (userId: string, id: string) => {
    const row = await prisma.workflow.findFirst({ where: { id, userId } });
    return row ? toStored(row) : null;
  };

  return {
    list: (userId) =>
      prisma.workflow.findMany({
        where: { userId },
        select: summaryFields,
        orderBy: { updatedAt: "desc" },
      }),

    count: (userId) => prisma.workflow.count({ where: { userId } }),

    find,

    create: async (userId, { name, graph }) =>
      toStored(await prisma.workflow.create({ data: { userId, name, graphJson: toJson(graph) } })),

    // updateMany / deleteMany filtrent aussi sur userId : impossible de toucher au workflow d'autrui
    update: async (userId, id, { name, graph }) => {
      const { count } = await prisma.workflow.updateMany({
        where: { id, userId },
        data: { name, graphJson: toJson(graph), updatedAt: new Date() },
      });
      return count === 0 ? null : find(userId, id);
    },

    remove: async (userId, id) => {
      const { count } = await prisma.workflow.deleteMany({ where: { id, userId } });
      return count > 0;
    },
  };
}
