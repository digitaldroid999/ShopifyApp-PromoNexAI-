-- CreateTable
CREATE TABLE "stripe_customers" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_states" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "plan_id" TEXT,
    "subscription_credits_per_period" INTEGER NOT NULL DEFAULT 0,
    "period_end" TIMESTAMP(3),
    "addon_credits_balance" INTEGER NOT NULL DEFAULT 0,
    "free_credits_granted" BOOLEAN NOT NULL DEFAULT false,
    "premium_music" BOOLEAN NOT NULL DEFAULT false,
    "premium_voices" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_usage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_shop_key" ON "stripe_customers"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_key" ON "stripe_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_states_shop_key" ON "billing_states"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "credit_usage_shop_period_end_key" ON "credit_usage"("shop", "period_end");
