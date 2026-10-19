-- Authentification Firebase : un utilisateur est identifié par l'uid de son compte.
-- Avant elle, la table ne contenait que l'utilisateur de démonstration (et, en base de test,
-- des données de tests) : aucun n'a d'uid, on les supprime avec leurs workflows (CASCADE).
DELETE FROM "User";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authUid" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_authUid_key" ON "User"("authUid");
