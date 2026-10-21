import { randomUUID } from "node:crypto";
import type {
  StoredWorkflow,
  StoredWorkflowSummary,
  WorkflowRepository,
} from "./workflow.repository.js";

// Implémentation en mémoire, pour les tests de routes sans base de données
export function createMemoryWorkflowRepository(): WorkflowRepository {
  const rows = new Map<string, StoredWorkflow & { userId: string }>();

  const owned = (userId: string, id: string) => {
    const row = rows.get(id);
    return row && row.userId === userId ? row : undefined;
  };
  // Copie sans userId : l'appelant ne doit pas pouvoir modifier la ligne stockée
  const strip = (row: StoredWorkflow & { userId: string }): StoredWorkflow => {
    const { id, name, graph, createdAt, updatedAt } = row;
    return structuredClone({ id, name, graph, createdAt, updatedAt });
  };

  return {
    list: async (userId) =>
      [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(({ id, name, createdAt, updatedAt }): StoredWorkflowSummary => ({
          id,
          name,
          createdAt,
          updatedAt,
        })),

    count: async (userId) => [...rows.values()].filter((row) => row.userId === userId).length,

    find: async (userId, id) => {
      const row = owned(userId, id);
      return row ? strip(row) : null;
    },

    create: async (userId, { name, graph }) => {
      const now = new Date();
      const row = {
        id: randomUUID(),
        userId,
        name,
        graph: structuredClone(graph),
        createdAt: now,
        updatedAt: now,
      };
      rows.set(row.id, row);
      return strip(row);
    },

    update: async (userId, id, { name, graph }) => {
      const row = owned(userId, id);
      if (!row) return null;
      Object.assign(row, { name, graph: structuredClone(graph), updatedAt: new Date() });
      return strip(row);
    },

    remove: async (userId, id) => owned(userId, id) !== undefined && rows.delete(id),
  };
}
