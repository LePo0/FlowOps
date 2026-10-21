/**
 * Sessions de démo et limites d'usage, vues depuis l'API.
 * Référence : docs/security/demo-sessions.md (A2 à A5, Q1 à Q3, Q5 à Q8).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Express } from "express";
import request from "supertest";
import { RunDetailSchema, sampleWorkflow } from "@flowops/shared";
import { createApp } from "./app.js";
import { createMemoryRunRepository } from "./modules/runs/memory-run.repository.js";
import { createMemoryWorkflowRepository } from "./modules/workflows/memory-workflow.repository.js";
import type { WorkflowRepository } from "./modules/workflows/workflow.repository.js";
import { as, fakeAuth } from "./test-support/fake-auth.js";
import { NOT_KEPT } from "./usage/stored-size.js";
import { DEMO_RUNS_PER_IP_PER_MINUTE, USAGE_PLANS } from "./usage/plans.js";

// Jetons « demo-… » : sessions de démo ; les autres : comptes vérifiés (test-support/fake-auth.ts)
const DEMO = "demo-visiteur";
const ALICE = "alice";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("sessions de démo", () => {
  let workflows: WorkflowRepository;
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let clock: number;
  let app: Express;

  const build = (overrides: Partial<Parameters<typeof createApp>[0]> = {}) =>
    createApp({
      fetch: fetchMock,
      auth: fakeAuth,
      workflows,
      runs: createMemoryRunRepository(workflows),
      now: () => clock,
      ...overrides,
    });
  const runUnsaved = (user: string, client = as(app, user)) =>
    client.post("/api/run").send({ graph: sampleWorkflow });

  beforeEach(() => {
    workflows = createMemoryWorkflowRepository();
    fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ products: [{ title: "A" }] }));
    clock = Date.UTC(2026, 9, 21, 8, 0, 0);
    app = build();
  });

  describe("identité", () => {
    it("A2 : accepte une session de démo, sans email", async () => {
      const res = await as(app, DEMO).get("/api/workflows");

      expect(res.status).toBe(200);
    });

    it("A4 : refuse les sessions de démo quand elles sont suspendues, pas les comptes vérifiés", async () => {
      app = build({ auth: { ...fakeAuth, demoSessionsEnabled: false } });

      const demo = await as(app, DEMO).get("/api/workflows");
      const verified = await as(app, ALICE).get("/api/workflows");

      expect(demo.status).toBe(403);
      expect(demo.body.errors[0].code).toBe("DEMO_SESSIONS_DISABLED");
      expect(verified.status).toBe(200);
    });

    it("A5 : une session de démo ne voit pas le workflow d'un autre utilisateur", async () => {
      const { id } = await workflows.create(ALICE, { name: "Privé", graph: sampleWorkflow });

      const res = await as(app, DEMO).get(`/api/workflows/${id}`);

      expect(res.status).toBe(404);
    });
  });

  describe("limites d'exécution", () => {
    it("Q1 : au-delà de la limite par minute → 429 avec Retry-After, sans appeler d'URL", async () => {
      const { runsPerMinute } = USAGE_PLANS.demo;
      for (let i = 0; i < runsPerMinute; i++) {
        expect((await runUnsaved(DEMO)).status).toBe(200);
      }
      fetchMock.mockClear();

      const refused = await runUnsaved(DEMO);

      expect(refused.status).toBe(429);
      expect(refused.body.errors[0].code).toBe("RATE_LIMITED");
      expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("Q1 : la limite se libère une minute plus tard", async () => {
      for (let i = 0; i < USAGE_PLANS.demo.runsPerMinute; i++) await runUnsaved(DEMO);

      clock += 60_000;

      expect((await runUnsaved(DEMO)).status).toBe(200);
    });

    it("Q1 : un compte vérifié a une limite plus large", async () => {
      for (let i = 0; i < USAGE_PLANS.demo.runsPerMinute; i++) await runUnsaved(ALICE);

      expect((await runUnsaved(ALICE)).status).toBe(200);
    });

    it("Q1 : l'exécution d'un workflow enregistré compte aussi", async () => {
      const { id } = await workflows.create(DEMO, { name: "Démo", graph: sampleWorkflow });
      for (let i = 0; i < USAGE_PLANS.demo.runsPerMinute; i++) await runUnsaved(DEMO);

      const res = await as(app, DEMO)
        .post(`/api/workflows/${id}/runs`)
        .send({ graph: sampleWorkflow });

      expect(res.status).toBe(429);
    });

    it("Q2 : plusieurs sessions de démo depuis la même adresse partagent une limite", async () => {
      // Chaque session reste sous sa propre limite, mais l'adresse dépasse la sienne
      const sessions = Math.ceil(DEMO_RUNS_PER_IP_PER_MINUTE / USAGE_PLANS.demo.runsPerMinute);
      let accepted = 0;
      for (let s = 0; s <= sessions; s++) {
        for (let i = 0; i < USAGE_PLANS.demo.runsPerMinute; i++) {
          if ((await runUnsaved(`demo-${s}`)).status === 200) accepted++;
        }
      }

      expect(accepted).toBe(DEMO_RUNS_PER_IP_PER_MINUTE);
      const refused = await runUnsaved("demo-nouvelle");
      expect(refused.status).toBe(429);
      // Les comptes vérifiés ne sont pas limités par adresse
      expect((await runUnsaved(ALICE)).status).toBe(200);
    });

    it("Q3 : une seule exécution à la fois pour une session de démo", async () => {
      let started!: () => void;
      const isStarted = new Promise<void>((resolve) => (started = resolve));
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => (finish = resolve));
      fetchMock.mockImplementationOnce(async () => {
        started();
        await finished;
        return jsonResponse({ products: [] });
      });

      const first = runUnsaved(DEMO).then((res) => res);
      await isStarted;
      const second = await runUnsaved(DEMO);
      finish();

      expect(second.status).toBe(429);
      expect((await first).status).toBe(200);
      // La place est libérée à la fin de la première
      expect((await runUnsaved(DEMO)).status).toBe(200);
    });

    it("Q8 : derrière un proxy, l'adresse est celle ajoutée par le proxy, pas celle du client", async () => {
      app = build({ trustProxyHops: 1 });
      const from = (user: string, forwardedFor: string) =>
        runUnsaved(user, as(app, user).set("x-forwarded-for", forwardedFor));

      // Le client invente une adresse différente à chaque requête (à gauche) : sans effet
      let accepted = 0;
      for (let i = 0; i <= DEMO_RUNS_PER_IP_PER_MINUTE; i++) {
        const res = await from(`demo-${i}`, `10.0.0.${i}, 203.0.113.7`);
        if (res.status === 200) accepted++;
      }
      expect(accepted).toBe(DEMO_RUNS_PER_IP_PER_MINUTE);

      // Une autre adresse réelle a sa propre limite
      expect((await from("demo-autre", "198.51.100.1")).status).toBe(200);
    });

    it("Q8 : les adresses IPv6 d'un même /64 partagent une limite", async () => {
      app = build({ trustProxyHops: 1 });
      let accepted = 0;
      for (let i = 0; i <= DEMO_RUNS_PER_IP_PER_MINUTE; i++) {
        const user = `demo-${i}`;
        const res = await runUnsaved(
          user,
          as(app, user).set("x-forwarded-for", `2001:db8:1:2::${i + 1}`),
        );
        if (res.status === 200) accepted++;
      }

      expect(accepted).toBe(DEMO_RUNS_PER_IP_PER_MINUTE);
    });
  });

  describe("quotas", () => {
    it("Q4 : la taille maximale de réponse d'une session de démo s'applique à l'exécution", async () => {
      const big = "x".repeat(USAGE_PLANS.demo.maxResponseBytes + 1);
      fetchMock.mockImplementation(async () => jsonResponse({ products: [{ title: big }] }));

      const demo = await runUnsaved(DEMO);
      const verified = await runUnsaved(ALICE);

      expect(demo.body.nodeResults[1]).toMatchObject({ status: "FAILED" });
      expect(demo.body.nodeResults[1].error).toMatch(/volumineuse/);
      expect(verified.body.nodeResults[1]).toMatchObject({ status: "SUCCESS" });
    });

    it("Q5 : une session de démo garde au plus 5 workflows", async () => {
      const save = (user: string) =>
        as(app, user).post("/api/workflows").send({ name: "W", graph: sampleWorkflow });
      const max = USAGE_PLANS.demo.maxWorkflows ?? 0;
      for (let i = 0; i < max; i++) expect((await save(DEMO)).status).toBe(201);

      const refused = await save(DEMO);

      expect(refused.status).toBe(403);
      expect(refused.body.errors[0].code).toBe("QUOTA_EXCEEDED");
      // Pas de limite pour un compte vérifié
      for (let i = 0; i <= max; i++) expect((await save(ALICE)).status).toBe(201);
    });

    it("Q6 : une session de démo garde les 10 exécutions les plus récentes d'un workflow", async () => {
      const { id } = await workflows.create(DEMO, { name: "Démo", graph: sampleWorkflow });
      const kept = USAGE_PLANS.demo.keptRunsPerWorkflow;
      for (let i = 0; i < kept + 2; i++) {
        // Une minute entre chaque exécution : la limite par minute n'intervient pas
        clock += 60_000;
        expect(
          (await as(app, DEMO).post(`/api/workflows/${id}/runs`).send({ graph: sampleWorkflow }))
            .status,
        ).toBe(201);
      }

      const list = await as(app, DEMO).get(`/api/workflows/${id}/runs`);

      expect(list.body.runs).toHaveLength(kept);
    });

    it("Q7 : au-delà de la limite de stockage, l'historique ne garde pas les sorties, la réponse si", async () => {
      // Sous la limite de taille de réponse, mais au-delà du stockage une fois répétée
      const chunk = "x".repeat(USAGE_PLANS.demo.maxResponseBytes - 1000);
      fetchMock.mockImplementation(async () => jsonResponse({ products: [{ title: chunk }] }));
      const { id } = await workflows.create(DEMO, { name: "Démo", graph: sampleWorkflow });

      const res = await as(app, DEMO)
        .post(`/api/workflows/${id}/runs`)
        .send({ graph: sampleWorkflow });
      const detail = RunDetailSchema.parse(res.body);
      const stored = RunDetailSchema.parse(
        (await as(app, DEMO).get(`/api/runs/${detail.id}`)).body,
      );

      const output = (run: typeof detail, nodeId: string) =>
        run.nodeResults.find((result) => result.nodeId === nodeId)?.output;
      expect(output(detail, "names")).toEqual([{ title: chunk }]);
      // http1 (≈ 300 Ko) tient dans les 500 Ko ; names, qui le répète, dépasse
      expect(output(stored, "http1")).toEqual(output(detail, "http1"));
      expect(output(stored, "names")).toBe(NOT_KEPT);
      expect(stored.nodeResults.find((result) => result.nodeId === "names")?.status).toBe(
        "SUCCESS",
      );
    });

    it("Q7 : un compte vérifié garde les sorties complètes", async () => {
      const chunk = "x".repeat(USAGE_PLANS.demo.maxResponseBytes - 1000);
      fetchMock.mockImplementation(async () => jsonResponse({ products: [{ title: chunk }] }));
      const { id } = await workflows.create(ALICE, { name: "Démo", graph: sampleWorkflow });

      const res = await as(app, ALICE)
        .post(`/api/workflows/${id}/runs`)
        .send({ graph: sampleWorkflow });
      const stored = (
        await request(app).get(`/api/runs/${res.body.id}`).auth(ALICE, { type: "bearer" })
      ).body;

      expect(stored.nodeResults[3].output).toEqual([{ title: chunk }]);
    });
  });
});
