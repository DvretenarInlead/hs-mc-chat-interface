-- CreateTable: portals
CREATE TABLE "portals" (
    "id" TEXT NOT NULL,
    "hubspotPortalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portals_hubspotPortalId_key" ON "portals"("hubspotPortalId");

-- CreateTable: otp_codes
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- Add new SecurityEventType values
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'OTP_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'OTP_VERIFIED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'OTP_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PORTAL_CONNECTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PORTAL_DISCONNECTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'USER_REGISTERED';

-- Add portalId to users
ALTER TABLE "users" ADD COLUMN "portalId" TEXT;

-- AddForeignKey: users.portalId -> portals.id
ALTER TABLE "users" ADD CONSTRAINT "users_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove HubSpot-specific columns from users (now on portals table)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_hubspotUserId_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "hubspotUserId";
ALTER TABLE "users" DROP COLUMN IF EXISTS "hubspotPortalId";
ALTER TABLE "users" DROP COLUMN IF EXISTS "accessToken";
ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshToken";
ALTER TABLE "users" DROP COLUMN IF EXISTS "tokenExpiresAt";
