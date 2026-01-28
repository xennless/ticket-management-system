-- DropIndex
DROP INDEX "TicketActivity_createdAt_idx";

-- DropIndex
DROP INDEX "TicketActivity_ticketId_type_idx";

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_idx" ON "TicketActivity"("ticketId");
