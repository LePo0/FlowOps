import { expect, type Page } from "@playwright/test";
import { EMULATOR_URL, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from "./environment.ts";

export interface Account {
  email: string;
  password: string;
}

// Adresse unique par test : les comptes de l'émulateur durent tant qu'il tourne
export function newAccount(label: string): Account {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { email: `${label}-${suffix}@e2e.test`, password: "mot-de-passe-e2e" };
}

async function emulator(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${EMULATOR_URL}${path}`, {
    ...init,
    // « owner » : jeton d'administration accepté par l'émulateur seul
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
  });
  if (!response.ok)
    throw new Error(`Émulateur ${path} : ${response.status} ${await response.text()}`);
  return response.json();
}

// Compte à l'adresse déjà vérifiée, créé sans passer par l'écran d'inscription
export async function createVerifiedAccount(label: string): Promise<Account> {
  const account = newAccount(label);
  const { localId } = (await emulator(
    `/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    { method: "POST", body: JSON.stringify({ ...account, returnSecureToken: true }) },
  )) as { localId: string };
  await emulator(
    `/identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:update`,
    {
      method: "POST",
      body: JSON.stringify({ localId, emailVerified: true }),
    },
  );
  return account;
}

// Ouvre le lien de vérification que l'émulateur a « envoyé » à cette adresse
export async function openVerificationLink(email: string): Promise<void> {
  const { oobCodes } = (await emulator(
    `/emulator/v1/projects/${FIREBASE_PROJECT_ID}/oobCodes`,
  )) as { oobCodes: { email: string; requestType: string; oobLink: string }[] };
  const link = oobCodes.findLast(
    (code) => code.email === email && code.requestType === "VERIFY_EMAIL",
  );
  if (!link) throw new Error(`Aucun lien de vérification pour ${email}`);
  const response = await fetch(link.oobLink);
  if (!response.ok) throw new Error(`Lien de vérification refusé : ${response.status}`);
}

// Sans compte, le visiteur arrive dans une session de démo
export async function expectDemoSession(page: Page): Promise<void> {
  await expect(page.locator(".user-menu__email")).toHaveText("Session de démo");
}

// Depuis la session de démo, par le bouton de l'en-tête. Sans recharger la page si elle est
// déjà ouverte (après une déconnexion, par exemple)
export async function signIn(page: Page, account: Account): Promise<void> {
  if (page.url() === "about:blank") await page.goto("/");
  await expectDemoSession(page);
  await page.getByRole("button", { name: "Se connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connexion" });
  await dialog.getByLabel("Email").fill(account.email);
  await dialog.getByLabel("Mot de passe").fill(account.password);
  await dialog.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator(".user-menu__email")).toHaveText(account.email);
}
