import { expect, type Locator, type Page } from "@playwright/test";

// Accès à l'éditeur par ce que l'utilisateur voit : nœuds du canvas, panneau, barres d'en-tête

export const canvasNode = (page: Page, id: string): Locator =>
  page.locator(`.react-flow__node[data-id="${id}"]`);

export const panel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Configuration du nœud" });

export const runSummary = (page: Page): Locator => page.locator(".run-bar__summary");

export async function selectNode(page: Page, id: string): Promise<void> {
  await canvasNode(page, id).click();
  await expect(panel(page).locator(".panel__id > code")).toHaveText(id);
}

export async function setHttpUrl(page: Page, nodeId: string, url: string): Promise<void> {
  await selectNode(page, nodeId);
  await panel(page).getByLabel("URL", { exact: true }).fill(url);
  await expect(canvasNode(page, nodeId)).toContainText(url);
}

// Statut affiché sur chaque nœud après une exécution (Réussi, Échec, Ignoré)
export async function expectNodeStatuses(
  page: Page,
  statuses: Record<string, "Réussi" | "Échec" | "Ignoré">,
): Promise<void> {
  for (const [id, status] of Object.entries(statuses)) {
    await expect(canvasNode(page, id).locator(".flow-node__status")).toHaveText(status);
  }
}

// Attend la réponse de l'API : /api/run, ou /api/workflows/:id/runs pour un workflow enregistré
export async function run(page: Page): Promise<void> {
  const executed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /^\/api\/(run|workflows\/[^/]+\/runs)$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Exécuter" }).click();
  await executed;
}

export async function save(page: Page, name?: string): Promise<void> {
  if (name !== undefined) await page.getByLabel("Nom du workflow").fill(name);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator(".document-bar__status")).toHaveText("Enregistré");
}
