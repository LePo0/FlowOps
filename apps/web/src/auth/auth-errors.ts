const WRONG_CREDENTIALS = "Email ou mot de passe incorrect.";

const MESSAGES: Partial<Record<string, string>> = {
  "auth/invalid-credential": WRONG_CREDENTIALS,
  "auth/invalid-login-credentials": WRONG_CREDENTIALS,
  "auth/wrong-password": WRONG_CREDENTIALS,
  "auth/user-not-found": WRONG_CREDENTIALS,
  "auth/invalid-email": "Adresse email invalide.",
  "auth/missing-email": "Adresse email requise.",
  "auth/missing-password": "Mot de passe requis.",
  "auth/email-already-in-use":
    "Un compte existe déjà avec cette adresse : connectez-vous, ou utilisez « Mot de passe oublié ».",
  "auth/weak-password": "Mot de passe trop faible : 6 caractères au minimum.",
  "auth/password-does-not-meet-requirements":
    "Le mot de passe ne respecte pas les règles demandées.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth/user-disabled": "Ce compte est désactivé.",
  "auth/network-request-failed": "Firebase est injoignable. Vérifiez votre connexion.",
  "auth/popup-blocked":
    "Le navigateur a bloqué la fenêtre de connexion Google : autorisez les fenêtres pour ce site.",
  "auth/account-exists-with-different-credential":
    "Un compte existe déjà avec cette adresse : connectez-vous avec votre mot de passe.",
  "auth/unauthorized-domain": "Ce domaine n'est pas autorisé dans la console Firebase.",
  "auth/operation-not-allowed": "Cette méthode de connexion n'est pas activée dans Firebase.",
};

// Fenêtre Google fermée par l'utilisateur : ce n'est pas une erreur à afficher
const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

// Message à afficher pour une erreur de connexion, ou null s'il n'y a rien à dire
export function authErrorMessage(error: unknown): string | null {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
  if (code && SILENT.has(code)) return null;
  return (code && MESSAGES[code]) ?? "La connexion a échoué. Réessayez.";
}
