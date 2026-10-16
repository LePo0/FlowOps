import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    // Le front appelle /api sur sa propre origine : pas de CORS à gérer en local
    // API_URL permet de viser une autre instance (ex. une seconde API locale sur un autre port)
    proxy: {
      "/api": process.env.API_URL ?? "http://localhost:3000",
    },
  },
});
