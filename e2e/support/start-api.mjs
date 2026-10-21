// Lance l'API des tests de bout en bout : base créée si besoin, migrée et vidée, puis serveur
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";

const apiDir = fileURLToPath(new URL("../../apps/api/", import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL manquante");

// CREATE DATABASE depuis la base « postgres » du même serveur (rôle avec le droit CREATEDB)
const target = new URL(databaseUrl);
const name = decodeURIComponent(target.pathname.slice(1));
const admin = new URL(databaseUrl);
admin.pathname = "/postgres";
const adminClient = new pg.Client({ connectionString: admin.href });
await adminClient.connect();
const { rowCount } = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
  name,
]);
if (rowCount === 0) await adminClient.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
await adminClient.end();

const prismaCli = createRequire(`${apiDir}package.json`).resolve("prisma/build/index.js");
const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: apiDir,
  env: process.env,
  encoding: "utf8",
});
if (migration.status !== 0) {
  throw new Error(`Migration impossible :\n${migration.stdout}\n${migration.stderr}`);
}

// Chaque lancement repart d'une base vide (les comptes de l'émulateur sont aussi en mémoire)
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
await client.query('TRUNCATE "User" CASCADE');
await client.end();

const tsx = createRequire(`${apiDir}package.json`).resolve("tsx/cli");
const api = spawn(process.execPath, [tsx, "src/index.ts"], {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
});
api.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => api.kill(signal));
