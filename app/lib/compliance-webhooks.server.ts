/**
 * Mandatory compliance webhook handlers for Shopify App Store.
 * Handles customers/data_request, customers/redact, and shop/redact.
 * @see https://shopify.dev/docs/apps/build/privacy-law-compliance
 */

import db from "../db.server";

const LOG = "[compliance]";

export type DataRequestPayload = {
  shop_id?: number;
  shop_domain?: string;
  customer?: { id: number; email?: string | null; phone?: string | null };
  orders_requested?: number[];
  data_request?: { id: number };
};

export type CustomersRedactPayload = {
  shop_id?: number;
  shop_domain?: string;
  customer?: { id: number; email?: string | null; phone?: string | null };
  orders_to_redact?: number[] | null;
};

export type ShopRedactPayload = {
  shop_id?: number;
  shop_domain?: string;
};

function normalizeShopDomain(shop: string): string {
  return shop.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
}

export async function handleComplianceWebhook(
  topic: string,
  payload: unknown,
  shop: string
): Promise<void> {
  const normalizedShop = normalizeShopDomain(shop);

  if (topic === "customers/data_request") {
    await handleDataRequest(payload as DataRequestPayload, normalizedShop);
  } else if (topic === "customers/redact") {
    await handleCustomersRedact(payload as CustomersRedactPayload, normalizedShop);
  } else if (topic === "shop/redact") {
    await handleShopRedact(payload as ShopRedactPayload, normalizedShop);
  } else {
    console.warn(`${LOG} unknown topic=${topic}`);
  }
}

async function handleDataRequest(
  payload: DataRequestPayload,
  shopDomain: string
): Promise<void> {
  const customerId = payload.customer?.id;
  console.log(
    `${LOG} data_request shop=${shopDomain} customerId=${customerId} data_request_id=${payload.data_request?.id}`
  );

  // This app does not store data keyed by Shopify customer ID; only store-level data (shop).
  // Document response for the store owner; in production you might email this or use Admin API.
  const dataForStoreOwner = {
    app: "PromoNexAI",
    shop_domain: shopDomain,
    customer_id: customerId,
    message:
      "This app does not store personal data keyed by customer ID. Only store-level data (e.g. product videos) is stored, keyed by shop.",
    data_export: [] as unknown[],
  };

  console.log(`${LOG} data_request result (for store owner):`, JSON.stringify(dataForStoreOwner));
}

async function handleCustomersRedact(
  payload: CustomersRedactPayload,
  shopDomain: string
): Promise<void> {
  const customerId = payload.customer?.id;
  console.log(
    `${LOG} customers/redact shop=${shopDomain} customerId=${customerId} orders_to_redact=${JSON.stringify(payload.orders_to_redact)}`
  );

  // No tables are keyed by Shopify customer id. If you add customer-scoped data later:
  // await db.someModel.deleteMany({ where: { shop: shopDomain, customerId: String(customerId) } });
  console.log(`${LOG} customers/redact completed (no customer-keyed data stored)`);
}

async function handleShopRedact(payload: ShopRedactPayload, shopDomain: string): Promise<void> {
  const rawShop = payload.shop_domain ?? shopDomain;
  const normalized = normalizeShopDomain(rawShop);

  console.log(`${LOG} shop/redact shop=${normalized}`);

  await db.$transaction(async (tx) => {
    // Delete in order of foreign keys: Task -> Short (VideoScene/AudioInfo cascade or delete first)
    const shorts = await tx.short.findMany({
      where: { userId: normalized },
      select: { id: true },
    });
    const shortIds = shorts.map((s) => s.id);

    await tx.task.deleteMany({ where: { shortId: { in: shortIds } } });
    await tx.short.deleteMany({ where: { userId: normalized } });

    await tx.session.deleteMany({ where: { shop: normalized } });
    await tx.billingState.deleteMany({ where: { shop: normalized } });
    await tx.creditUsage.deleteMany({ where: { shop: normalized } });
    await tx.legalAgreement.deleteMany({ where: { shop: normalized } });
    await tx.stripeCustomer.deleteMany({ where: { shop: normalized } });
    await tx.promoWorkflowTemp.deleteMany({ where: { shop: normalized } });
    await tx.referral.deleteMany({
      where: { OR: [{ referrerShop: normalized }, { referredShop: normalized }] },
    });
  });

  console.log(`${LOG} shop/redact completed for ${normalized}`);
}
