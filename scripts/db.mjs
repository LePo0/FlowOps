// Instance PostgreSQL locale de FlowOps, pour le développement.
//
// Elle utilise les programmes d'une installation PostgreSQL existante, mais avec un dossier de
// données appartenant à l'utilisateur : pas besoin des droits administrateur ni du mot de passe
// de l'instance système. Port 5433 pour ne pas gêner une instance déjà présente sur le 5432.
// Le dossier de données doit rester hors de OneDrive : la synchronisation corromprait la base.
//
// Usage : node scripts/db.mjs start | stop | status
// Variables facultatives : PG_BIN (dossier des programmes), PG_DATA (dossier de données).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const bin = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\18\\bin";
const data =
  process.env.PG_DATA ?? join(process.env.LOCALAPPDATA ?? "", "flowops-postgres", "data");
const pgCtl = join(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");

const commands = {
  // stdio ignoré : le serveur ne doit pas hériter de la console, sinon elle reste bloquée
  start: {
    args: ["-D", data, "-l", join(dirname(data), "postgres.log"), "-w", "start"],
    stdio: "ignore",
  },
  stop: { args: ["-D", data, "-m", "fast", "stop"], stdio: "inherit" },
  status: { args: ["-D", data, "status"], stdio: "inherit" },
};

const command = commands[process.argv[2]];
if (!command) {
  console.error("Usage : node scripts/db.mjs start | stop | status");
  process.exit(1);
}
if (!existsSync(pgCtl)) {
  console.error(`pg_ctl introuvable : ${pgCtl}. Indiquez le dossier des programmes avec PG_BIN.`);
  process.exit(1);
}
if (!existsSync(data)) {
  console.error(
    `Dossier de données introuvable : ${data}. Voir docs/architecture.md (Persistance).`,
  );
  process.exit(1);
}

const result = spawnSync(pgCtl, command.args, { stdio: command.stdio, windowsHide: true });
if (process.argv[2] === "start") {
  console.log(
    result.status === 0
      ? "PostgreSQL démarré (port 5433)."
      : "Échec du démarrage : voir postgres.log.",
  );
}
process.exit(result.status ?? 1);
