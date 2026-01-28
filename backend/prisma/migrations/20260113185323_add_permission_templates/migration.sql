/*
  Warnings:

  - You are about to drop the column `updatedBy` on the `SystemSettings` table. All the data in the column will be lost.
  - You are about to drop the `TicketFavorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TicketFavorite" DROP CONSTRAINT "TicketFavorite_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "TicketFavorite" DROP CONSTRAINT "TicketFavorite_userId_fkey";

-- DropForeignKey
ALTER TABLE "TicketTemplate" DROP CONSTRAINT "TicketTemplate_createdById_fkey";

-- AlterTable
ALTER TABLE "SystemSettings" DROP COLUMN "updatedBy",
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseSLA" INTEGER,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolutionSLA" INTEGER,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "slaId" TEXT,
ADD COLUMN     "slaStatus" TEXT;

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "bodyHtml" TEXT;

-- DropTable
DROP TABLE "TicketFavorite";

-- DropTable
DROP TABLE "TicketTemplate";

-- CreateTable
CREATE TABLE "PermissionTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionTemplateItem" (
    "templateId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "PermissionTemplateItem_pkey" PRIMARY KEY ("templateId","permissionId")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTagRelation" (
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TicketTagRelation_pkey" PRIMARY KEY ("ticketId","tagId")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketWatcher" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketDependency" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSLA" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" "TicketPriority",
    "categoryId" TEXT,
    "firstResponseTime" INTEGER,
    "resolutionTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSLA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTimeEntry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "minutes" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketRating" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "ratedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMention" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketWorkflowRule" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionTemplate_code_key" ON "PermissionTemplate"("code");

-- CreateIndex
CREATE INDEX "PermissionTemplate_code_idx" ON "PermissionTemplate"("code");

-- CreateIndex
CREATE INDEX "PermissionTemplateItem_permissionId_idx" ON "PermissionTemplateItem"("permissionId");

-- CreateIndex
CREATE INDEX "TicketCategory_isActive_idx" ON "TicketCategory"("isActive");

-- CreateIndex
CREATE INDEX "TicketCategory_name_idx" ON "TicketCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTag_name_key" ON "TicketTag"("name");

-- CreateIndex
CREATE INDEX "TicketTag_name_idx" ON "TicketTag"("name");

-- CreateIndex
CREATE INDEX "TicketTagRelation_tagId_idx" ON "TicketTagRelation"("tagId");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAttachment_messageId_idx" ON "TicketAttachment"("messageId");

-- CreateIndex
CREATE INDEX "TicketAttachment_uploadedById_idx" ON "TicketAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "TicketWatcher_userId_idx" ON "TicketWatcher"("userId");

-- CreateIndex
CREATE INDEX "TicketWatcher_ticketId_idx" ON "TicketWatcher"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "TicketDependency_dependsOnId_idx" ON "TicketDependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "TicketDependency_type_idx" ON "TicketDependency"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TicketDependency_ticketId_dependsOnId_key" ON "TicketDependency"("ticketId", "dependsOnId");

-- CreateIndex
CREATE INDEX "TicketSLA_isActive_idx" ON "TicketSLA"("isActive");

-- CreateIndex
CREATE INDEX "TicketSLA_priority_idx" ON "TicketSLA"("priority");

-- CreateIndex
CREATE INDEX "TicketSLA_categoryId_idx" ON "TicketSLA"("categoryId");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_ticketId_idx" ON "TicketTimeEntry"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_userId_idx" ON "TicketTimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TicketTimeEntry_date_idx" ON "TicketTimeEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TicketRating_ticketId_key" ON "TicketRating"("ticketId");

-- CreateIndex
CREATE INDEX "TicketRating_ratedById_idx" ON "TicketRating"("ratedById");

-- CreateIndex
CREATE INDEX "TicketRating_rating_idx" ON "TicketRating"("rating");

-- CreateIndex
CREATE INDEX "TicketMention_userId_idx" ON "TicketMention"("userId");

-- CreateIndex
CREATE INDEX "TicketMention_messageId_idx" ON "TicketMention"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMention_messageId_userId_key" ON "TicketMention"("messageId", "userId");

-- CreateIndex
CREATE INDEX "TicketMessageReaction_messageId_idx" ON "TicketMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "TicketMessageReaction_userId_idx" ON "TicketMessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMessageReaction_messageId_userId_emoji_key" ON "TicketMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "TicketWorkflow_isActive_idx" ON "TicketWorkflow"("isActive");

-- CreateIndex
CREATE INDEX "TicketWorkflowRule_workflowId_idx" ON "TicketWorkflowRule"("workflowId");

-- CreateIndex
CREATE INDEX "TicketWorkflowRule_triggerType_idx" ON "TicketWorkflowRule"("triggerType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_createdAt_idx" ON "AuditLog"("entityType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "SystemSettings_updatedById_idx" ON "SystemSettings"("updatedById");

-- CreateIndex
CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");

-- CreateIndex
CREATE INDEX "Ticket_slaStatus_idx" ON "Ticket"("slaStatus");

-- CreateIndex
CREATE INDEX "Ticket_status_assignedToId_idx" ON "Ticket"("status", "assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_status_priority_createdAt_idx" ON "Ticket"("status", "priority", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_status_updatedAt_idx" ON "Ticket"("assignedToId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_createdById_status_idx" ON "Ticket"("createdById", "status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_isActive_deletedAt_idx" ON "User"("isActive", "deletedAt");

-- AddForeignKey
ALTER TABLE "PermissionTemplateItem" ADD CONSTRAINT "PermissionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PermissionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionTemplateItem" ADD CONSTRAINT "PermissionTemplateItem_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "TicketSLA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TicketTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDependency" ADD CONSTRAINT "TicketDependency_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketDependency" ADD CONSTRAINT "TicketDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSLA" ADD CONSTRAINT "TicketSLA_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeEntry" ADD CONSTRAINT "TicketTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRating" ADD CONSTRAINT "TicketRating_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRating" ADD CONSTRAINT "TicketRating_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMention" ADD CONSTRAINT "TicketMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMention" ADD CONSTRAINT "TicketMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessageReaction" ADD CONSTRAINT "TicketMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessageReaction" ADD CONSTRAINT "TicketMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWorkflowRule" ADD CONSTRAINT "TicketWorkflowRule_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "TicketWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
