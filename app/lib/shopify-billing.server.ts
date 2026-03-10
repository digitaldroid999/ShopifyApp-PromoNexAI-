/**
 * Shopify Billing API (GraphQL) for PromoNexAI.
 * Subscriptions via appSubscriptionCreate; one-time via appPurchaseOneTimeCreate.
 * Syncs BillingState from currentAppInstallation.activeSubscriptions.
 */

import { getBillingState } from "./billing-state.server";

/** Credits per period for subscription plan IDs */
export const PLAN_CREDITS: Record<string, number> = {
  starter_monthly: 10,
  starter_yearly: 10,
  pro_monthly: 30,
  pro_yearly: 30,
  business_monthly: 75,
  business_yearly: 75,
};

/** One-time addon key -> credits to add */
export const ADDON_CREDITS: Record<string, number> = {
  addon_10: 10,
  addon_25: 25,
  addon_50: 50,
};

/** Plan key -> { amount USD, interval } for appSubscriptionCreate */
export const PLAN_PRICING: Record<string, { amount: number; interval: "EVERY_30_DAYS" | "ANNUAL" }> = {
  starter_monthly: { amount: 49, interval: "EVERY_30_DAYS" },
  starter_yearly: { amount: 470, interval: "ANNUAL" },
  pro_monthly: { amount: 99, interval: "EVERY_30_DAYS" },
  pro_yearly: { amount: 950, interval: "ANNUAL" },
  business_monthly: { amount: 199, interval: "EVERY_30_DAYS" },
  business_yearly: { amount: 1910, interval: "ANNUAL" },
  premium_music: { amount: 9, interval: "EVERY_30_DAYS" },
  premium_voices: { amount: 15, interval: "EVERY_30_DAYS" },
};

/** Addon key -> { amount USD, name } for appPurchaseOneTimeCreate */
export const ADDON_PRICING: Record<string, { amount: number; name: string }> = {
  addon_10: { amount: 39, name: "Extra 10 video credits" },
  addon_25: { amount: 79, name: "Extra 25 video credits" },
  addon_50: { amount: 149, name: "Extra 50 video credits" },
};

/** Map (amount, interval) from Shopify response to our planId */
function pricingToPlanId(amount: number, interval: string): string | null {
  for (const [key, p] of Object.entries(PLAN_PRICING)) {
    if (p.amount === amount && p.interval === interval) return key;
  }
  return null;
}

type GraphQLAdmin = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const APP_SUBSCRIPTION_CREATE = `#graphql
mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
  appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
    userErrors { field message }
    confirmationUrl
    appSubscription { id }
  }
}`;

const APP_PURCHASE_ONE_TIME_CREATE = `#graphql
mutation AppPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
  appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
    userErrors { field message }
    confirmationUrl
    appPurchaseOneTime { id }
  }
}`;

const CURRENT_APP_INSTALLATION = `#graphql
query CurrentAppInstallation {
  currentAppInstallation {
    activeSubscriptions {
      id
      currentPeriodEnd
      lineItems {
        plan {
          pricingDetails {
            ... on AppRecurringPricing {
              price { amount }
              interval
            }
          }
        }
      }
    }
  }
}`;

const APP_SUBSCRIPTION_CANCEL = `#graphql
mutation AppSubscriptionCancel($id: ID!) {
  appSubscriptionCancel(id: $id) {
    userErrors { field message }
    appSubscription { id status }
  }
}`;

/**
 * Create a Shopify app subscription (plan and optional premium line items).
 * Returns confirmationUrl for redirect.
 */
export async function createSubscription(params: {
  admin: GraphQLAdmin;
  shop: string;
  planKey: string;
  premiumKeys?: string[];
  returnUrl: string;
  test?: boolean;
}): Promise<{ url: string } | { error: string }> {
  const { admin, planKey, premiumKeys = [], returnUrl, test = false } = params;
  const planPricing = PLAN_PRICING[planKey];
  if (!planPricing) return { error: "Invalid plan" };

  const lineItems: Array<{ plan: { appRecurringPricingDetails: { price: { amount: number; currencyCode: string }; interval: string } } }> = [
    {
      plan: {
        appRecurringPricingDetails: {
          price: { amount: planPricing.amount, currencyCode: "USD" },
          interval: planPricing.interval,
        },
      },
    },
  ];
  for (const key of premiumKeys) {
    const p = PLAN_PRICING[key];
    if (p && (key === "premium_music" || key === "premium_voices"))
      lineItems.push({
        plan: {
          appRecurringPricingDetails: {
            price: { amount: p.amount, currencyCode: "USD" },
            interval: p.interval,
          },
        },
      });
  }

  const name = `PromoNexAI - ${keyToLabel(planKey)}`;

  const res = await admin.graphql(APP_SUBSCRIPTION_CREATE, {
    variables: {
      name,
      returnUrl,
      lineItems,
      ...(test ? { test: true } : {}),
    },
  });
  const json = await res.json();
  const payload = json?.data?.appSubscriptionCreate;
  const err = payload?.userErrors?.[0];
  if (err) return { error: err.message || "Subscription create failed" };
  const url = payload?.confirmationUrl;
  if (!url) return { error: "No confirmation URL returned" };
  return { url };
}

function keyToLabel(key: string): string {
  const labels: Record<string, string> = {
    starter_monthly: "Starter Monthly",
    starter_yearly: "Starter Yearly",
    pro_monthly: "Pro Monthly",
    pro_yearly: "Pro Yearly",
    business_monthly: "Business Monthly",
    business_yearly: "Business Yearly",
    premium_music: "Premium Music",
    premium_voices: "Premium Voices",
  };
  return labels[key] ?? key;
}

/**
 * Create a one-time purchase (addon credits). Returns confirmationUrl.
 */
export async function createOneTimePurchase(params: {
  admin: GraphQLAdmin;
  addonKey: string;
  returnUrl: string;
  test?: boolean;
}): Promise<{ url: string } | { error: string }> {
  const { admin, addonKey, returnUrl, test = false } = params;
  const pricing = ADDON_PRICING[addonKey];
  if (!pricing) return { error: "Invalid addon" };

  const res = await admin.graphql(APP_PURCHASE_ONE_TIME_CREATE, {
    variables: {
      name: pricing.name,
      price: { amount: pricing.amount, currencyCode: "USD" },
      returnUrl,
      ...(test ? { test: true } : {}),
    },
  });
  const json = await res.json();
  const payload = json?.data?.appPurchaseOneTimeCreate;
  const err = payload?.userErrors?.[0];
  if (err) return { error: err.message || "One-time purchase failed" };
  const url = payload?.confirmationUrl;
  if (!url) return { error: "No confirmation URL returned" };
  return { url };
}

const SHOPIFY_API_VERSION = "2024-10";

/** Call Shopify Admin GraphQL with shop + accessToken (e.g. from webhook session). */
async function graphqlWithToken(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json?.data;
}

/** Sync BillingState from Shopify using shop + accessToken (for webhooks). */
export async function syncBillingStateFromShopifyWithToken(shop: string, accessToken: string): Promise<void> {
  const data = await graphqlWithToken(shop, accessToken, CURRENT_APP_INSTALLATION) as { currentAppInstallation?: { activeSubscriptions?: unknown[] } };
  const subs = data?.currentAppInstallation?.activeSubscriptions ?? [];
  await applySubscriptionsToBillingState(shop, subs);
}

/** Sync BillingState from Shopify currentAppInstallation.activeSubscriptions */
export async function syncBillingStateFromShopify(admin: GraphQLAdmin, shop: string): Promise<void> {
  const res = await admin.graphql(CURRENT_APP_INSTALLATION);
  const json = await res.json();
  const installation = json?.data?.currentAppInstallation;
  const subs = installation?.activeSubscriptions ?? [];
  await applySubscriptionsToBillingState(shop, subs);
}

async function applySubscriptionsToBillingState(shop: string, subs: unknown[]): Promise<void> {
  if (subs.length === 0) {
    await clearSubscriptionState(shop);
    return;
  }

  let planId: string | null = null;
  let subscriptionCreditsPerPeriod = 0;
  let periodEnd: Date | null = null;
  let primarySubscriptionId: string | null = null;
  let premiumMusic = false;
  let premiumVoices = false;

  type SubLineItem = { plan?: { pricingDetails?: { price?: { amount: string }; interval?: string } } };
  type SubRecord = { id: string; currentPeriodEnd?: string; lineItems?: SubLineItem[] };
  const typedSubs = subs as SubRecord[];
  for (const sub of typedSubs) {
    const subId = sub.id;
    const end = sub.currentPeriodEnd;
    const periodEndDate = end ? new Date(end) : null;
    for (const item of sub.lineItems ?? []) {
      const details = item?.plan?.pricingDetails;
      if (!details?.price?.amount) continue;
      const amount = parseFloat(String(details.price.amount));
      const interval = details.interval ?? "EVERY_30_DAYS";
      const key = pricingToPlanId(amount, interval);
      if (!key) continue;
      if (PLAN_CREDITS[key] !== undefined) {
        planId = key;
        subscriptionCreditsPerPeriod = PLAN_CREDITS[key];
        if (periodEndDate) {
          periodEnd = periodEndDate;
          primarySubscriptionId = subId;
        }
      } else if (key === "premium_music") premiumMusic = true;
      else if (key === "premium_voices") premiumVoices = true;
    }
  }

  if (!primarySubscriptionId && typedSubs.length > 0) {
    const first = typedSubs[0];
    primarySubscriptionId = first.id;
    periodEnd = first.currentPeriodEnd ? new Date(first.currentPeriodEnd) : null;
  }

  await getBillingState().upsert({
    where: { shop },
    create: {
      shop,
      shopifySubscriptionId: primarySubscriptionId,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd,
      premiumMusic,
      premiumVoices,
    },
    update: {
      shopifySubscriptionId: primarySubscriptionId,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd,
      premiumMusic,
      premiumVoices,
    },
  });
}

/** Clear subscription fields when subscription is cancelled/deleted */
export async function clearSubscriptionState(shop: string): Promise<void> {
  await getBillingState().updateMany({
    where: { shop },
    data: {
      shopifySubscriptionId: null,
      stripeSubscriptionId: null,
      planId: null,
      subscriptionCreditsPerPeriod: 0,
      periodEnd: null,
      premiumMusic: false,
      premiumVoices: false,
    },
  });
}

/** Get current subscription and credits summary for the subscription page */
export async function getSubscriptionDetails(shop: string): Promise<{
  planId: string | null;
  subscriptionCreditsPerPeriod: number;
  addonCreditsBalance: number;
  periodEnd: Date | null;
  premiumMusic: boolean;
  premiumVoices: boolean;
  hasActiveSubscription: boolean;
  shopifySubscriptionId: string | null;
} | null> {
  const state = await getBillingState().findUnique({
    where: { shop },
    select: {
      planId: true,
      subscriptionCreditsPerPeriod: true,
      addonCreditsBalance: true,
      periodEnd: true,
      premiumMusic: true,
      premiumVoices: true,
      stripeSubscriptionId: true,
      shopifySubscriptionId: true,
    },
  });
  if (!state) return null;
  const hasActive = !!(state.shopifySubscriptionId || state.stripeSubscriptionId) && !!state.planId;
  return {
    planId: state.planId,
    subscriptionCreditsPerPeriod: state.subscriptionCreditsPerPeriod,
    addonCreditsBalance: state.addonCreditsBalance,
    periodEnd: state.periodEnd,
    premiumMusic: state.premiumMusic,
    premiumVoices: state.premiumVoices,
    hasActiveSubscription: hasActive,
    shopifySubscriptionId: state.shopifySubscriptionId ?? null,
  };
}

/** Add one-time credits to addonCreditsBalance (for addon_10, addon_25, addon_50). */
export async function addAddonCredits(shop: string, addonKey: string, amount?: number): Promise<void> {
  const credits = amount ?? ADDON_CREDITS[addonKey] ?? 0;
  if (credits <= 0) return;

  await getBillingState().upsert({
    where: { shop },
    create: { shop, addonCreditsBalance: credits },
    update: { addonCreditsBalance: { increment: credits } },
  });
}

/** Cancel Shopify app subscription by GID */
export async function cancelSubscription(admin: GraphQLAdmin, subscriptionId: string): Promise<{ error?: string }> {
  const res = await admin.graphql(APP_SUBSCRIPTION_CANCEL, {
    variables: { id: subscriptionId },
  });
  const json = await res.json();
  const payload = json?.data?.appSubscriptionCancel;
  const err = payload?.userErrors?.[0];
  if (err) return { error: err.message ?? "Cancel failed" };
  return {};
}
