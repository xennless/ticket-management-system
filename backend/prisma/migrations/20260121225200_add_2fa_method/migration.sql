-- AlterTable
ALTER TABLE "TwoFactorAuth" ADD COLUMN     "method" TEXT DEFAULT 'TOTP';
