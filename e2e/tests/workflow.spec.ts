import { expect, test } from "@playwright/test";
import { createVerifiedAccount, signIn } from "../support/accounts.ts";
import {
  expectNodeStatuses,
  panel,
  run,
  runSummary,
  save,
  selectNode,
  setHttpUrl,
} from "../support/editor.ts";
import { API_URL, TARGET_URL } from "../support/environment.ts";

// Le workflow de démonstration (déclencheur → http1 → check → names) est le point de départ :
// on remplace seulement l'URL de http1 par le service cible des tests.

test.beforeEach(async ({ page }) => {
  await signIn(page, await createVerifiedAccount("workflow"));
});

test("nominal : enregistrer, exécuter, lire le résultat et le retrouver dans l'historique", async ({
  page,
}) => {
  await setHttpUrl(page, "http1", `${TARGET_URL}/produits`);
  await save(page, "Produits");

  await run(page);

  await expect(runSummary(page)).toContainText("Succès");
  await expect(runSummary(page)).toContainText("ajoutée à l'historique");
  await expectNodeStatuses(page, {
    trigger: "Réussi",
    http1: "Réussi",
    check: "Réussi",
    names: "Réussi",
  });
  await selectNode(page, "names");
  await expect(panel(page).getByLabel("Dernière exécution")).toContainText('"title": "Clavier"');
  await expect(panel(page).getByLabel("Dernière exécution")).toContainText('"title": "Souris"');

  await page.getByRole("button", { name: "Historique" }).click();
  const history = page.getByRole("dialog", { name: "Historique · Produits" });
  await expect(
    history.getByRole("navigation", { name: "Exécutions" }).getByRole("button"),
  ).toHaveCount(1);
  await expect(history.getByRole("article", { name: "Détail de l'exécution" })).toContainText(
    "Extraire les noms · Transformation",
  );
});

test("erreur : une cible interdite fait échouer le nœud HTTP, la suite est ignorée", async ({
  page,
}) => {
  // L'API elle-même, sur la boucle locale : toujours refusée, quelle que soit la configuration
  await setHttpUrl(page, "http1", `${API_URL}/health`);

  await run(page);

  await expect(runSummary(page)).toContainText("Échec sur GET produits");
  await expectNodeStatuses(page, {
    trigger: "Réussi",
    http1: "Échec",
    check: "Ignoré",
    names: "Ignoré",
  });
  await selectNode(page, "http1");
  await expect(panel(page).getByLabel("Dernière exécution")).toContainText("Adresse non autorisée");
});

test("erreur du service appelé : un 404 n'est pas un échec, la condition prend la branche faux", async ({
  page,
}) => {
  await setHttpUrl(page, "http1", `${TARGET_URL}/absent`);

  await run(page);

  await expect(runSummary(page)).toContainText("Succès");
  await expectNodeStatuses(page, {
    http1: "Réussi",
    check: "Réussi",
    names: "Ignoré",
  });
  await selectNode(page, "check");
  await expect(panel(page).getByLabel("Dernière exécution")).toContainText('"result": false');
});

test("modification : l'historique garde la version exécutée, et la relance la rejoue telle quelle", async ({
  page,
}) => {
  await setHttpUrl(page, "http1", `${TARGET_URL}/produits`);
  await save(page, "Catalogue");
  await run(page);
  await expectNodeStatuses(page, { names: "Réussi" });

  // Version modifiée et enregistrée : le service répond 404, la transformation est ignorée
  await setHttpUrl(page, "http1", `${TARGET_URL}/absent`);
  await save(page);
  await run(page);
  await expectNodeStatuses(page, { names: "Ignoré" });

  // Le workflow rouvert au rechargement est la dernière version enregistrée
  await page.reload();
  await expect(page.getByLabel("Nom du workflow")).toHaveValue("Catalogue");
  await expect(page.locator('.react-flow__node[data-id="http1"]')).toContainText(
    `${TARGET_URL}/absent`,
  );

  await page.getByRole("button", { name: "Historique" }).click();
  const history = page.getByRole("dialog", { name: "Historique · Catalogue" });
  const runs = history.getByRole("navigation", { name: "Exécutions" }).getByRole("button");
  const detail = history.getByRole("article", { name: "Détail de l'exécution" });
  await expect(runs).toHaveCount(2);

  // La plus ancienne : copie du graphe d'origine, transformation réussie
  await runs.nth(1).click();
  await expect(
    detail.getByRole("region", { name: "Extraire les noms · Transformation" }),
  ).toContainText("Réussi");

  // Relancée : rejoue cette copie, pas la version actuelle du workflow
  await detail.getByRole("button", { name: "Relancer" }).click();
  await expect(runs).toHaveCount(3);
  await expect(runs.first()).toHaveAttribute("aria-current", "true");
  await expect(
    detail.getByRole("region", { name: "Extraire les noms · Transformation" }),
  ).toContainText("Réussi");
});
