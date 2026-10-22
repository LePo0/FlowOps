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
  // Tests de bout en bout uniquement : accepte les jetons non signés de l'émulateur Firebase
  // Auth (ex. 127.0.0.1:9099). Refusé en production et hors d'un projet demo-* (server-config.ts).
  FIREBASE_AUTH_EMULATOR_HOST: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  // Politique réseau du nœud HTTP (docs/security/http-node.md). Vides : adresses publiques seules.
  HTTP_ALLOWED_TARGETS: z.string().default(""),
  HTTP_DENIED_TARGETS: z.string().default(""),
  // Sessions de démo (docs/security/demo-sessions.md) : false refuse les jetons anonymes, sans
  // redéployer de code, si un abus est constaté
  DEMO_SESSIONS_ENABLED: z.stringbool().default(true),
  // Proxys de confiance devant l'API : 0 en local, 2 derrière Firebase Hosting et Cloud Run
  // (mesure : deploy/README.md)
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Diagnostic temporaire : journalise les en-têtes d'adresse reçus (réglage de TRUST_PROXY_HOPS)
  LOG_FORWARDED_FOR: z.stringbool().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

export const env = EnvSchema.parse(process.env);
