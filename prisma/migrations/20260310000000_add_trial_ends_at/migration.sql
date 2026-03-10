-- AlterTable
ALTER TABLE "billing_states" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "billing_states" ADD COLUMN "trial_credits_balance" INTEGER NOT NULL DEFAULT 0;
