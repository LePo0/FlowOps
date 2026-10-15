import { describe, it, expect } from "vitest";
import { demoWorkflow } from "@flowops/shared";
import { executeWorkflow } from "./execute-workflow.js";
import type { ExecutionResult, NodeResult } from "./types.js";

function jsonFetch(status: number, body: unknown): typeof fetch {
    return async () =>
        new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        });
}

function statuses(nodeResults: NodeResult[]): Record<string, string> {
    return Object.fromEntries(nodeResults.map((result) => [result.nodeId, result.status]));
}

async function run(
    fetchImpl: typeof fetch,
): Promise<Exclude<ExecutionResult, { status: "INVALID" }>> {
    const result = await executeWorkflow(demoWorkflow, { fetch: fetchImpl });
    if (result.status === "INVALID") throw new Error("Graphe de démo invalide");
    return result;
}

describe("executeWorkflow", () => {
    it("exécute le scénario nominal de bout en bout", async () => {
        const result = await run(
            jsonFetch(200, {
                products: [
                    { id: 1, title: "A", price: 10 },
                    { id: 2, title: "B", price: 20 },
                ],
            }),
        );

        expect(result.status).toBe("SUCCESS");
        expect(statuses(result.nodeResults)).toEqual({
            trigger: "SUCCESS",
            http1: "SUCCESS",
            check: "SUCCESS",
            names: "SUCCESS",
        });
        expect(result.nodeResults.find((r) => r.nodeId === "names")?.output).toEqual([
            { title: "A" },
            { title: "B" },
        ]);
    });

    it("ne traite pas un 404 comme une erreur du moteur : la branche non sélectionnée est ignorée", async () => {
        const result = await run(jsonFetch(404, { message: "Not found" }));

        expect(result.status).toBe("SUCCESS");
        expect(statuses(result.nodeResults)).toEqual({
            trigger: "SUCCESS",
            http1: "SUCCESS",
            check: "SUCCESS",
            names: "SKIPPED",
        });
    });

    it("marque le nœud HTTP en échec sur une erreur réseau et ignore la suite", async () => {
        const failingFetch: typeof fetch = async () => {
            throw new Error("ECONNREFUSED");
        };
        const result = await run(failingFetch);

        expect(result.status).toBe("FAILED");
        expect(statuses(result.nodeResults)).toEqual({
            trigger: "SUCCESS",
            http1: "FAILED",
            check: "SKIPPED",
            names: "SKIPPED",
        });
        expect(result.nodeResults.find((r) => r.nodeId === "http1")?.error).toBe("ECONNREFUSED");
    });

    it("rejette un graphe invalide sans rien exécuter", async () => {
        const graph = structuredClone(demoWorkflow);
        graph.edges.push({ id: "e4", source: "names", target: "http1" });

        const result = await executeWorkflow(graph, { fetch: jsonFetch(200, {}) });
        expect(result.status).toBe("INVALID");
    });
});
