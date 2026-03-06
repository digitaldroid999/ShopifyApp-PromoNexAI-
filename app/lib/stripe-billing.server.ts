/**
 * Stripe Checkout and Customer Portal for PromoNexAI.
 * Price IDs should be set in env (e.g. STRIPE_PRICE_STARTER_MONTHLY).
 */

import { getStripe, getOrCreateStripeCustomer } from "./stripe.server";
import prisma from "../db.server";

// Map Stripe Price ID to plan/addon behavior. Use env vars so you can set real IDs.
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
 * Sync BillingState from a Stripe subscription object (e.g. after webhook or on subscription page load).
 */
export async function syncBillingStateFromSubscription(shop: string, subscription: { id: string; current_period_end: number; items: { data: Array<{ price: { id: string } }> } }): Promise<void> {
  const periodEnd = new Date(subscription.current_period_end * 1000);
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

  await prisma.billingState.upsert({
    where: { shop },
    create: {
      shop,
      stripeSubscriptionId: subscription.id,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd,
      premiumMusic,
      premiumVoices,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      planId,
      subscriptionCreditsPerPeriod,
      periodEnd,
      premiumMusic,
      premiumVoices,
    },
  });
}

/**
 * Clear subscription fields when subscription is cancelled/deleted.
 */
export async function clearSubscriptionState(shop: string): Promise<void> {
  await prisma.billingState.updateMany({
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
 * Add one-time credits to addonCreditsBalance (for addon_10, addon_25, addon_50).
 */
export async function addAddonCredits(shop: string, priceId: string, amount: number): Promise<void> {
  const key = priceIdToKey(priceId);
  const credits = key ? ADDON_CREDITS[key] ?? amount : amount;
  if (credits <= 0) return;

  await prisma.billingState.upsert({
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
