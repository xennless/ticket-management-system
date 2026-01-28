-- CreateTable
CREATE TABLE "FileUploadLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "ticketId" TEXT,
    "attachmentId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUploadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileUploadLog_userId_idx" ON "FileUploadLog"("userId");

-- CreateIndex
CREATE INDEX "FileUploadLog_status_idx" ON "FileUploadLog"("status");

-- CreateIndex
CREATE INDEX "FileUploadLog_ticketId_idx" ON "FileUploadLog"("ticketId");

-- CreateIndex
CREATE INDEX "FileUploadLog_createdAt_idx" ON "FileUploadLog"("createdAt");

-- AddForeignKey
ALTER TABLE "FileUploadLog" ADD CONSTRAINT "FileUploadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
