-- CreateTable
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastFailedIp" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpLockout" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpLockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountLockout_userId_key" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_userId_idx" ON "AccountLockout"("userId");

-- CreateIndex
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- CreateIndex
CREATE INDEX "AccountLockout_lockedUntil_userId_idx" ON "AccountLockout"("lockedUntil", "userId");

-- CreateIndex
CREATE INDEX "IpLockout_ip_idx" ON "IpLockout"("ip");

-- CreateIndex
CREATE INDEX "IpLockout_lockedUntil_idx" ON "IpLockout"("lockedUntil");

-- CreateIndex
CREATE INDEX "IpLockout_lockedUntil_ip_idx" ON "IpLockout"("lockedUntil", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "IpLockout_ip_key" ON "IpLockout"("ip");

-- AddForeignKey
ALTER TABLE "AccountLockout" ADD CONSTRAINT "AccountLockout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLockout" ADD CONSTRAINT "AccountLockout_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
