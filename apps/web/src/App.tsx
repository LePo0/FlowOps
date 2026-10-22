import { useEffect } from "react";
import { demoWorkflow } from "@flowops/shared";
import { AuthCard } from "./auth/AuthCard.tsx";
import { DemoBanner } from "./auth/DemoBanner.tsx";
import { LoginDialog } from "./auth/LoginDialog.tsx";
import { LoginScreen } from "./auth/LoginScreen.tsx";
import { UserMenu } from "./auth/UserMenu.tsx";
import { VerifyEmailScreen } from "./auth/VerifyEmailScreen.tsx";
import { authConfigured, useAuthStore } from "./auth/session.ts";
import { Canvas } from "./editor/Canvas.tsx";
import { NodePanel } from "./editor/panel/NodePanel.tsx";
import { RunBar } from "./run/RunBar.tsx";
import { DocumentBar } from "./workflows/DocumentBar.tsx";
import { useDocumentStore } from "./workflows/use-document.ts";
import "./App.css";

function Editor() {
  const demo = useAuthStore((state) => state.status === "demo");
  const login = useAuthStore((state) => state.login);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">FlowOps</h1>
        <DocumentBar />
        <RunBar />
        <UserMenu />
      </header>
      {demo && <DemoBanner />}
      <main className="app__body">
        <div className="app__canvas">
          <Canvas />
        </div>
        <NodePanel />
      </main>
      {demo && login && <LoginDialog mode={login} />}
    </div>
  );
}

function App() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (!authConfigured) return;
    const stop = useAuthStore.getState().start();
    // Changement de compte (déconnexion, session de démo quittée pour un compte existant) : rien
    // du compte précédent ne reste à l'écran ni dans le stockage local (dernier workflow ouvert),
    // le suivant repart du graphe de départ. Une session de démo devenue un vrai compte garde son
    // uid : son workflow reste ouvert.
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      const before = previous.user?.uid;
      if (before !== undefined && before !== state.user?.uid) {
        useDocumentStore.getState().newDocument(demoWorkflow);
      }
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

  if (!authConfigured) {
    return (
      <AuthCard title="Configuration manquante">
        <p>
          Les variables <code>VITE_FIREBASE_*</code> sont absentes de{" "}
          <code>apps/web/.env.local</code> : voir le README, section « Authentification ».
        </p>
      </AuthCard>
    );
  }
  if (status === "loading") return <AuthCard title="Chargement…">{null}</AuthCard>;
  if (status === "signedOut") return <LoginScreen />;
  if (status === "unverified") return <VerifyEmailScreen />;
  return <Editor />;
}

export default App;
