-- AlterTable
ALTER TABLE "referrals" ADD COLUMN     "referred_first_payment_at" TIMESTAMP(3),
ADD COLUMN     "referred_plan_id" TEXT,
ADD COLUMN     "referrer_reward_amount" DECIMAL(10,2),
ADD COLUMN     "referrer_reward_eligible_at" TIMESTAMP(3),
ADD COLUMN     "referrer_reward_paid_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "referral_payouts" (
    "id" TEXT NOT NULL,
    "referrer_shop" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "method" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_payouts_pkey" PRIMARY KEY ("id")
);
