import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 ne lit plus .env lui-même. Absent en CI : `prisma generate` n'a pas besoin de la base.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
