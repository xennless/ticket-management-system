-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "color" TEXT,
ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
