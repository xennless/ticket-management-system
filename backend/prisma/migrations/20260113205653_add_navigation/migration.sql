-- CreateTable
CREATE TABLE "NavSection" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCollapsible" BOOLEAN NOT NULL DEFAULT true,
    "defaultOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "icon" TEXT,
    "permission" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavSection_code_key" ON "NavSection"("code");

-- CreateIndex
CREATE INDEX "NavSection_order_idx" ON "NavSection"("order");

-- CreateIndex
CREATE INDEX "NavSection_isActive_idx" ON "NavSection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NavItem_code_key" ON "NavItem"("code");

-- CreateIndex
CREATE INDEX "NavItem_sectionId_idx" ON "NavItem"("sectionId");

-- CreateIndex
CREATE INDEX "NavItem_order_idx" ON "NavItem"("order");

-- CreateIndex
CREATE INDEX "NavItem_isActive_idx" ON "NavItem"("isActive");

-- AddForeignKey
ALTER TABLE "NavItem" ADD CONSTRAINT "NavItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "NavSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
