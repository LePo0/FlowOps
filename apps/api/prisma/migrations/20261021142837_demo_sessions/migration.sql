-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "User_isAnonymous_lastSeenAt_idx" ON "User"("isAnonymous", "lastSeenAt");
