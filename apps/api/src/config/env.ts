import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Obligatoire pour démarrer le serveur (vérifié dans index.ts), facultatif pour les tests.
  // Une valeur vide (`DATABASE_URL=` dans .env.example) compte comme absente.
  DATABASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  // Projet Firebase dont les jetons sont acceptés. Même règle que DATABASE_URL.
  FIREBASE_PROJECT_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
});

export const env = EnvSchema.parse(process.env);
