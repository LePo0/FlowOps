import { expect, test } from "@playwright/test";
import { expectDemoSession, newAccount, openVerificationLink } from "../support/accounts.ts";
import { run, runSummary, save, setHttpUrl } from "../support/editor.ts";
import { TARGET_URL } from "../support/environment.ts";

// Sessions de démo : docs/security/demo-sessions.md (A1, A6, U1)

const FIRST_EXAMPLE = "Exemple 1 — Produits en stock";

test("A1 : sans compte, le visiteur arrive dans l'éditeur avec un exemple enregistré, historique compris", async ({
  page,
}) => {
  await page.goto("/");

  await expectDemoSession(page);
  await expect(page.getByRole("note")).toContainText("Session de démo");
  await expect(page.getByLabel("Nom du workflow")).toHaveValue(FIRST_EXAMPLE);
  await expect(page.locator(".document-bar__status")).toHaveText("Enregistré");

  // L'exemple appelle une API publique : les tests utilisent le service cible local
  await setHttpUrl(page, "http1", `${TARGET_URL}/produits`);
  await save(page);
  await run(page);

  await expect(runSummary(page)).toContainText("Succès");
  await expect(runSummary(page)).toContainText("ajoutée à l'historique");

  // A6 : même session après rechargement
  await page.reload();
  await expectDemoSession(page);
  await expect(page.getByLabel("Nom du workflow")).toHaveValue(FIRST_EXAMPLE);
  await page.getByRole("button", { name: "Ouvrir…" }).click();
  await expect(page.getByText("Exemple 3 — Erreur à corriger")).toBeVisible();
});

test("U1 : créer un compte depuis la démo garde les workflows de la session", async ({ page }) => {
  const account = newAccount("demo");
  await page.goto("/");
  await expect(page.getByLabel("Nom du workflow")).toHaveValue(FIRST_EXAMPLE);
  await page.getByLabel("Nom du workflow").fill("Mon workflow de démo");
  await save(page);

  await page.getByRole("button", { name: "Créer un compte" }).click();
  const dialog = page.getByRole("dialog", { name: "Créer un compte" });
  await expect(dialog).toContainText("seront gardés dans ce nouveau compte");
  await dialog.getByLabel("Email").fill(account.email);
  await dialog.getByLabel("Mot de passe").fill(account.password);
  await dialog.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page.getByRole("heading", { name: "Vérifiez votre adresse email" })).toBeVisible();
  await openVerificationLink(account.email);
  await page.getByRole("button", { name: "J'ai vérifié mon adresse" }).click();

  await expect(page.locator(".user-menu__email")).toHaveText(account.email);
  await expect(page.getByRole("note")).toBeHidden();
  await page.getByRole("button", { name: "Ouvrir…" }).click();
  await expect(page.getByText("Mon workflow de démo")).toBeVisible();
  await expect(page.getByText("Exemple 2 — Pokémon : références entre nœuds")).toBeVisible();
});

test("revenir à la démo depuis l'écran de connexion garde le workflow en cours", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Nom du workflow")).toHaveValue(FIRST_EXAMPLE);
  await page.getByLabel("Nom du workflow").fill("Brouillon non enregistré");

  await page.getByRole("button", { name: "Se connecter" }).click();
  await page
    .getByRole("dialog", { name: "Connexion" })
    .getByRole("button", { name: "Retour à la démo" })
    .click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByLabel("Nom du workflow")).toHaveValue("Brouillon non enregistré");
});
