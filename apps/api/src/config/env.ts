import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Optionnel pour l'instant : on le rendra obligatoire quand Prisma arrivera
  DATABASE_URL: z.string().url().optional(),
});

export const env = EnvSchema.parse(process.env);
