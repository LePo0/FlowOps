import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import "./index.css";
import App from "./App.tsx";

// Messages de validation des schémas partagés en français
z.config(z.locales.fr());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
