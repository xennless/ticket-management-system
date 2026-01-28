-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'QUARANTINED', 'SCAN_FAILED');

-- CreateEnum
CREATE TYPE "QuarantineReason" AS ENUM ('VIRUS', 'MIME_TYPE_MISMATCH', 'SUSPICIOUS', 'SCAN_FAILED', 'MANUAL');

-- AlterTable
ALTER TABLE "TicketAttachment" ADD COLUMN     "sanitizedFileName" TEXT NOT NULL DEFAULT '',
                                            ADD COLUMN     "detectedMimeType" TEXT,
                                            ADD COLUMN     "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
                                            ADD COLUMN     "scanResult" TEXT,
                                            ADD COLUMN     "scannedAt" TIMESTAMP(3),
                                            ADD COLUMN     "quarantineId" TEXT;

-- CreateTable
CREATE TABLE "QuarantineFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sanitizedFileName" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "quarantinePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "detectedMimeType" TEXT,
    "scanResult" TEXT,
    "reason" "QuarantineReason" NOT NULL,
    "ticketId" TEXT,
    "attachmentId" TEXT,
    "uploadedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuarantineFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttachment_quarantineId_key" ON "TicketAttachment"("quarantineId");

-- CreateIndex
CREATE INDEX "TicketAttachment_scanStatus_idx" ON "TicketAttachment"("scanStatus");

-- CreateIndex
CREATE INDEX "TicketAttachment_quarantineId_idx" ON "TicketAttachment"("quarantineId");

-- CreateIndex
CREATE UNIQUE INDEX "QuarantineFile_attachmentId_key" ON "QuarantineFile"("attachmentId");

-- CreateIndex
CREATE INDEX "QuarantineFile_scanResult_idx" ON "QuarantineFile"("scanResult");

-- CreateIndex
CREATE INDEX "QuarantineFile_reason_idx" ON "QuarantineFile"("reason");

-- CreateIndex
CREATE INDEX "QuarantineFile_uploadedById_idx" ON "QuarantineFile"("uploadedById");

-- CreateIndex
CREATE INDEX "QuarantineFile_createdAt_idx" ON "QuarantineFile"("createdAt");

-- CreateIndex
CREATE INDEX "QuarantineFile_releasedAt_idx" ON "QuarantineFile"("releasedAt");

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_quarantineId_fkey" FOREIGN KEY ("quarantineId") REFERENCES "QuarantineFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarantineFile" ADD CONSTRAINT "QuarantineFile_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "TicketAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarantineFile" ADD CONSTRAINT "QuarantineFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarantineFile" ADD CONSTRAINT "QuarantineFile_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarantineFile" ADD CONSTRAINT "QuarantineFile_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

