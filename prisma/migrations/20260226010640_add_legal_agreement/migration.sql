-- CreateTable
CREATE TABLE "legal_agreements" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "agreed_at" TIMESTAMP(3) NOT NULL,
    "terms_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_agreements_shop_key" ON "legal_agreements"("shop");
