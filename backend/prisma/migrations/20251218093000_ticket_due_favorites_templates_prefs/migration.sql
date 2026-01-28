-- Add due date to Ticket
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);

-- CreateTable: NotificationPreference
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "onAssigned" BOOLEAN NOT NULL DEFAULT true,
  "onStatusChange" BOOLEAN NOT NULL DEFAULT true,
  "onMention" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TicketFavorite
CREATE TABLE IF NOT EXISTS "TicketFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TicketTemplate
CREATE TABLE IF NOT EXISTS "TicketTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketTemplate_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE INDEX IF NOT EXISTS "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TicketFavorite_userId_ticketId_key" ON "TicketFavorite"("userId", "ticketId");
CREATE INDEX IF NOT EXISTS "TicketFavorite_userId_idx" ON "TicketFavorite"("userId");
CREATE INDEX IF NOT EXISTS "TicketFavorite_ticketId_idx" ON "TicketFavorite"("ticketId");

CREATE INDEX IF NOT EXISTS "TicketTemplate_isActive_idx" ON "TicketTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "TicketTemplate_createdById_idx" ON "TicketTemplate"("createdById");

CREATE INDEX IF NOT EXISTS "Ticket_dueAt_idx" ON "Ticket"("dueAt");

-- Foreign Keys
ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFavorite"
  ADD CONSTRAINT "TicketFavorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFavorite"
  ADD CONSTRAINT "TicketFavorite_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketTemplate"
  ADD CONSTRAINT "TicketTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


