/**
 * Stripe Checkout and Customer Portal for PromoNexAI.
 * Price IDs should be set in env (e.g. STRIPE_PRICE_STARTER_MONTHLY).
 */

import { getStripe, getOrCreateStripeCustomer } from "./stripe.server";
import prisma from "../db.server";

// Delegate access; Prisma client must be generated with BillingState model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
function getBillingState() {
  const delegate = prismaAny.billingState;
  if (!delegate) {
    throw new Error("Prisma client missing billingState. Run: npx prisma generate && npx prisma migrate deploy");
  }
  return delegate;
}

// Placeholder IDs used when env is not set; Stripe will reject these. Real IDs look like price_1ABC123...
const PLACEHOLDER_IDS = new Set([
  "price_starter_monthly", "price_starter_yearly", "price_pro_monthly", "price_pro_yearly",
  "price_business_monthly", "price_business_yearly", "price_addon_10", "price_addon_25", "price_addon_50",
  "price_premium_music", "price_premium_voices",
]);

// Map Stripe Price ID to plan/addon behavior. Set real Stripe Price IDs in .env (see README or .env.example).
export const STRIPE_PRICES: Record<string, string> = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "price_starter_monthly",
  starter_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "price_starter_yearly",
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly",
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "price_pro_yearly",
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "price_business_monthly",
  business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? "price_business_yearly",
  addon_10: process.env.STRIPE_PRICE_ADDON_10 ?? "price_addon_10",
  addon_25: process.env.STRIPE_PRICE_ADDON_25 ?? "price_addon_25",
  addon_50: process.env.STRIPE_PRICE_ADDON_50 ?? "price_addon_50",
  premium_music: process.env.STRIPE_PRICE_PREMIUM_MUSIC ?? "price_premium_music",
  premium_voices: process.env.STRIPE_PRICE_PREMIUM_VOICES ?? "price_premium_voices",
};

/** Credits per period for subscription plan IDs */
export const PLAN_CREDITS: Record<string, number> = {
  starter_monthly: 10,
  starter_yearly: 10,
  pro_monthly: 30,
  pro_yearly: 30,
  business_monthly: 75,
  business_yearly: 75,
};

/** One-time addon price ID -> credits to add */
export const ADDON_CREDITS: Record<string, number> = {
  addon_10: 10,
  addon_25: 25,
  addon_50: 50,
};

/** Resolve Stripe Price ID to our plan/addon key (e.g. starter_monthly, addon_10) */
export function priceIdToKey(priceId: string): string | null {
  for (const [key, id] of Object.entries(STRIPE_PRICES)) {
    if (id === priceId) return key;
  }
  return null;
}

export type CheckoutMode = "subscription" | "one_time";

/**
 * Create a Stripe Checkout Session.
 * - For subscription: pass priceId that is a plan (starter_monthly, pro_monthly, etc.).
 * - For one-time: pass priceId that is addon_10, addon_25, addon_50.
 * - For premium only: pass premium_music or premium_voices (subscription with one line item).
 */
export async function createCheckoutSession(params: {
  shop: string;
  mode: CheckoutMode;
  priceIds: string[];
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const { shop, mode, priceIds, successUrl, cancelUrl } = params;
  if (priceIds.length === 0) return { error: "At least one price required" };

  const placeholderUsed = priceIds.some((id) => PLACEHOLDER_IDS.has(id));
  if (placeholderUsed) {
    return {
      error:
        "Stripe Price IDs are not configured. Create products and prices in the Stripe Dashboard, then set STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_STARTER_MONTHLY, etc. in your .env file. See the subscription plan docs for the full list.",
    };
  }

  try {
    const stripeCustomerId = await getOrCreateStripeCustomer(shop);
    const stripe = getStripe();

    const sessionParams: {
      customer: string;
      mode: "subscription" | "payment";
      line_items?: { price: string; quantity: number }[];
      success_url: string;
      cancel_url: string;
      metadata?: { shop: string };
      subscription_data?: { metadata: { shop: string } };
    } = {
      customer: stripeCustomerId,
      mode: mode === "subscription" ? "subscription" : "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { shop },
    };

    if (mode === "subscription") {
      sessionParams.line_items = priceIds.map((id) => ({ price: id, quantity: 1 }));
      sessionParams.subscription_data = { metadata: { shop } };
    } else {
      sessionParams.line_items = priceIds.map((id) => ({ price: id, quantity: 1 }));
    }

    const session = await stripe.checkout.sessions.create(sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]);
    const url = session.url;
    if (!url) return { error: "Stripe did not return a checkout URL" };
    return { url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createCheckoutSession]", message);
    return { error: message };
  }
}

/**
 * Create a Stripe Customer Portal session so the merchant can manage subscription and payment methods.
 */
export async function createPortalSession(shop: string, returnUrl: string): Promise<{ url: string } | { error: string }> {
  try {
    const stripeCustomerId = await getOrCreateStripeCustomer(shop);
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    if (!portal.url) return { error: "Stripe did not return a portal URL" };
    return { url: portal.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createPortalSession]", message);
    return { error: message };
  }
}

/**
 * Parse current_period_end from a subscription into a valid Date or null.
 */
function parsePeriodEnd(sub: { current_period_end?: number }): Date | null {
  const raw = sub.current_period_end;
  const ts = typeof raw === "number" && Number.isFinite(raw) ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
  const d = Number.isFinite(ts) ? new Date(ts * 1000) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Sync BillingState from a single Stripe subscription (used when you have one subscription only).
 */
export async function syncBillingStateFromSubscription(shop: string, subscription: { id: string; current_period_end?: number; items: { data: Array<{ price: { id: string } }> } }): Promise<void> {
  const periodEndValid = parsePeriodEnd(subscription);
  let planId: string | null = null;
  let subscriptionCreditsPerPeriod = 0;
  let premiumMusic = false;
  let premiumVoices = false;

  for (const item of subscription.items.data) {
    const key = priceIdToKey(item.price.id);
    if (!key) continue;
    if (PLAN_CREDITS[key] !== undefined) {
      planId = key;
      subscriptionCreditsPerPeriod = PLAN_CREDITS[key];
    } else if (key === "premium_music") premiumMusic = true;
    else if (key === "premium_voices") premiumVoices = true;
  }

  await getBillingState().upsert({
    where: { shop },
    create: {
      shop,
      stripeSubscriptionId: subscription.id,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd: periodEndValid,
      premiumMusic,
      premiumVoices,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd: periodEndValid,
      premiumMusic,
      premiumVoices,
    },
  });
}

/**
 * Sync BillingState from ALL active subscriptions for a Stripe customer.
 * A customer can have multiple subscriptions (e.g. one for plan, one for premium add-ons).
 * We merge line items from every active/trialing subscription so the plan is not lost when
 * a second subscription (e.g. premium_music) is added.
 */
export async function syncBillingStateFromStripeCustomer(shop: string, stripeCustomerId: string): Promise<void> {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 100,
  });
  const trialing = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "trialing",
    limit: 100,
  });
  const all = [...subs.data, ...trialing.data];

  if (all.length === 0) {
    await clearSubscriptionState(shop);
    return;
  }

  let planId: string | null = null;
  let subscriptionCreditsPerPeriod = 0;
  let periodEndValid: Date | null = null;
  let primarySubscriptionId: string | null = null;
  let premiumMusic = false;
  let premiumVoices = false;

  for (const sub of all) {
    const periodEnd = parsePeriodEnd(sub);
    for (const item of sub.items.data) {
      const priceId = typeof item.price === "string" ? item.price : (item.price as { id?: string } | undefined)?.id;
      const key = priceId ? priceIdToKey(priceId) : null;
      if (!key) continue;
      if (PLAN_CREDITS[key] !== undefined) {
        planId = key;
        subscriptionCreditsPerPeriod = PLAN_CREDITS[key];
        if (periodEnd) {
          periodEndValid = periodEnd;
          primarySubscriptionId = sub.id;
        }
      } else if (key === "premium_music") premiumMusic = true;
      else if (key === "premium_voices") premiumVoices = true;
    }
  }

  if (!primarySubscriptionId && all.length > 0) {
    primarySubscriptionId = all[0].id;
    if (!periodEndValid) periodEndValid = parsePeriodEnd(all[0]);
  }

  await getBillingState().upsert({
    where: { shop },
    create: {
      shop,
      stripeSubscriptionId: primarySubscriptionId,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd: periodEndValid,
      premiumMusic,
      premiumVoices,
    },
    update: {
      stripeSubscriptionId: primarySubscriptionId,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd: periodEndValid,
      premiumMusic,
      premiumVoices,
    },
  });
}

/**
 * Clear subscription fields when subscription is cancelled/deleted.
 */
export async function clearSubscriptionState(shop: string): Promise<void> {
  await getBillingState().updateMany({
    where: { shop },
    data: {
      stripeSubscriptionId: null,
      planId: null,
      subscriptionCreditsPerPeriod: 0,
      periodEnd: null,
      premiumMusic: false,
      premiumVoices: false,
    },
  });
}

/**
 * Get current subscription and credits summary for display on the subscription page.
 */
export async function getSubscriptionDetails(shop: string): Promise<{
  planId: string | null;
  subscriptionCreditsPerPeriod: number;
  addonCreditsBalance: number;
  periodEnd: Date | null;
  premiumMusic: boolean;
  premiumVoices: boolean;
  hasActiveSubscription: boolean;
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
    },
  });
  if (!state) return null;
  return {
    planId: state.planId,
    subscriptionCreditsPerPeriod: state.subscriptionCreditsPerPeriod,
    addonCreditsBalance: state.addonCreditsBalance,
    periodEnd: state.periodEnd,
    premiumMusic: state.premiumMusic,
    premiumVoices: state.premiumVoices,
    hasActiveSubscription: !!(state.stripeSubscriptionId && state.planId),
  };
}

/**
 * Add one-time credits to addonCreditsBalance (for addon_10, addon_25, addon_50).
 */
export async function addAddonCredits(shop: string, priceId: string, amount: number): Promise<void> {
  const key = priceIdToKey(priceId);
  const credits = key ? ADDON_CREDITS[key] ?? amount : amount;
  if (credits <= 0) return;

  await getBillingState().upsert({
    where: { shop },
    create: {
      shop,
      addonCreditsBalance: credits,
    },
    update: {
      addonCreditsBalance: { increment: credits },
    },
  });
}
