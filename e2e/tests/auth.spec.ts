import { expect, test } from "@playwright/test";
import {
  createVerifiedAccount,
  newAccount,
  openVerificationLink,
  signIn,
} from "../support/accounts.ts";
import { save, setHttpUrl } from "../support/editor.ts";
import { TARGET_URL } from "../support/environment.ts";

test("inscription : l'adresse doit être vérifiée avant d'accéder à l'éditeur", async ({ page }) => {
  const account = newAccount("inscription");

  await page.goto("/");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page.getByRole("heading", { name: "Vérifiez votre adresse email" })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();

  // Pas encore vérifiée : on reste sur l'écran de vérification
  await page.getByRole("button", { name: "J'ai vérifié mon adresse" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exécuter" })).toBeHidden();

  await openVerificationLink(account.email);
  await page.getByRole("button", { name: "J'ai vérifié mon adresse" }).click();

  await expect(page.getByRole("button", { name: "Exécuter" })).toBeVisible();
  await expect(page.locator(".user-menu__email")).toHaveText(account.email);
});

test("déconnexion : rien du compte ne reste, et un autre compte ne voit pas ses workflows", async ({
  page,
}) => {
  const alice = await createVerifiedAccount("alice");
  const bob = await createVerifiedAccount("bob");

  await signIn(page, alice);
  await setHttpUrl(page, "http1", `${TARGET_URL}/alice`);
  await save(page, "Workflow d'Alice");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  await signIn(page, bob);
  // Workflow vierge (un déclencheur seul) : ni le nom ni le graphe d'Alice
  await expect(page.getByLabel("Nom du workflow")).toHaveValue("");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByText(`${TARGET_URL}/alice`)).toBeHidden();

  // Même après rechargement : le dernier workflow d'Alice n'est pas rouvert pour Bob
  await page.reload();
  await expect(page.getByRole("button", { name: "Exécuter" })).toBeVisible();
  await expect(page.getByText(`${TARGET_URL}/alice`)).toBeHidden();

  await page.getByRole("button", { name: "Ouvrir…" }).click();
  await expect(page.getByText("Aucun workflow enregistré pour l'instant.")).toBeVisible();
  await expect(page.getByText("Workflow d'Alice")).toBeHidden();
});
