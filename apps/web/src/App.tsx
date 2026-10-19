import { useEffect } from "react";
import { AuthCard } from "./auth/AuthCard.tsx";
import { LoginScreen } from "./auth/LoginScreen.tsx";
import { UserMenu } from "./auth/UserMenu.tsx";
import { VerifyEmailScreen } from "./auth/VerifyEmailScreen.tsx";
import { authConfigured, useAuthStore } from "./auth/session.ts";
import { Canvas } from "./editor/Canvas.tsx";
import { NodePanel } from "./editor/panel/NodePanel.tsx";
import { RunBar } from "./run/RunBar.tsx";
import { DocumentBar } from "./workflows/DocumentBar.tsx";
import { blankWorkflow, useDocumentStore } from "./workflows/use-document.ts";
import "./App.css";

function Editor() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">FlowOps</h1>
        <DocumentBar />
        <RunBar />
        <UserMenu />
      </header>
      <main className="app__body">
        <div className="app__canvas">
          <Canvas />
        </div>
        <NodePanel />
      </main>
    </div>
  );
}

function App() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (!authConfigured) return;
    const stop = useAuthStore.getState().start();
    // En quittant la session, rien du compte précédent ne reste à l'écran ni dans le stockage
    // local (dernier workflow ouvert) : le compte suivant repart d'un workflow vierge
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (previous.status === "signedIn" && state.status !== "signedIn") {
        useDocumentStore.getState().newDocument(blankWorkflow);
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
