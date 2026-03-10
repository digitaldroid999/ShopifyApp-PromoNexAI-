/**
 * Credit logic: getCredits, consumeCredit.
 * 7-day free trial with 1 credit (1 credit = 1 complete video). Trial credit expires at trial end.
 * Re-installing users get no trial. After trial, must subscribe or access is restricted.
 */

import prisma from "../db.server";

const TRIAL_DAYS = 7;
const TRIAL_CREDITS = 1;
const TRIAL_ENDING_SOON_DAYS = 2;
const ADDON_ONLY_PERIOD_END = new Date("2099-12-31T23:59:59Z");

/** End of current month UTC (last moment of the month). */
function endOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** Start of current month UTC. */
function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * For yearly plans, credits reset each calendar month until the subscription ends.
 * For monthly plans (or addon-only), the period is the billing period (single periodEnd).
 * For trial, the period end is trialEndsAt.
 */
function getEffectivePeriodEnd(state: {
  planId: string | null;
  periodEnd: Date | null;
  trialEndsAt: Date | null;
}): Date {
  if (state.planId?.endsWith("_yearly") && state.periodEnd) {
    const endOfMonth = endOfCurrentMonthUTC();
    return state.periodEnd < endOfMonth ? state.periodEnd : endOfMonth;
  }
  if (state.periodEnd) return state.periodEnd;
  if (state.trialEndsAt) return state.trialEndsAt;
  return ADDON_ONLY_PERIOD_END;
}

/** Subscription credits available for the current period (month for yearly, billing period for monthly). */
function getSubscriptionCreditsThisPeriod(state: {
  planId: string | null;
  periodEnd: Date | null;
  subscriptionCreditsPerPeriod: number;
}): number {
  if (state.planId?.endsWith("_yearly") && state.periodEnd) {
    return state.periodEnd >= startOfCurrentMonthUTC() ? state.subscriptionCreditsPerPeriod : 0;
  }
  return state.subscriptionCreditsPerPeriod;
}

/** Trial credits only count if now < trialEndsAt; use trialCreditsBalance. */
function getTrialCreditsAllowed(
  state: { trialEndsAt: Date | null; planId: string | null; trialCreditsBalance: number },
  now: Date,
): number {
  if (state.planId) return 0;
  if (!state.trialEndsAt || now >= state.trialEndsAt) return 0;
  return Math.min(state.trialCreditsBalance, TRIAL_CREDITS);
}

// Delegate access; Prisma client must be generated with BillingState and CreditUsage models
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
function getBillingState() {
  const delegate = prismaAny.billingState;
  if (!delegate) {
    throw new Error("Prisma client missing billingState. Run: npx prisma generate && npx prisma migrate deploy");
  }
  return delegate;
}
function getCreditUsage() {
  const delegate = prismaAny.creditUsage;
  if (!delegate) {
    throw new Error("Prisma client missing creditUsage. Run: npx prisma generate && npx prisma migrate deploy");
  }
  return delegate;
}

export type CreditsResult = {
  allowed: number;
  used: number;
  remaining: number;
  isPremiumMusic: boolean;
  isPremiumVoices: boolean;
  planId: string | null;
  periodEnd: Date | null;
  trialEndsAt: Date | null;
  trialEndingSoon: boolean;
  trialEnded: boolean;
  hasActiveSubscription: boolean;
};

/**
 * Get or create BillingState for shop.
 * New install: 7-day trial with 1 credit. Reinstall: no trial.
 * Returns allowed, used, remaining, trial flags, and premium flags.
 */
export async function getCredits(shop: string): Promise<CreditsResult> {
  const billingState = getBillingState();
  const creditUsage = getCreditUsage();
  const now = new Date();
  // Existing shop: one findUnique. New install: upsert to avoid unique constraint on concurrent create.
  let state = await billingState.findUnique({ where: { shop } });
  if (!state) {
    state = await billingState.upsert({
      where: { shop },
      create: {
        shop,
        trialCreditsBalance: TRIAL_CREDITS,
        freeCreditsGranted: true,
        trialEndsAt: addDays(now, TRIAL_DAYS),
      },
      update: {},
    });
  }

  // Legacy: had old "3 free credits" (freeCreditsGranted true, trialEndsAt null) → mark trial as ended once
  if (state.freeCreditsGranted && state.trialEndsAt == null) {
    state = await billingState.update({
      where: { shop },
      data: { trialEndsAt: now },
    });
  }

  const trialEndsAt = state.trialEndsAt ? new Date(state.trialEndsAt) : null;
  const inTrial = trialEndsAt && now < trialEndsAt && !state.planId;
  const trialEnded = !!trialEndsAt && now >= trialEndsAt && !state.planId;
  const trialEndingSoon =
    !!trialEndsAt && now < trialEndsAt && !state.planId && addDays(now, TRIAL_ENDING_SOON_DAYS) >= trialEndsAt;

  const periodEnd = getEffectivePeriodEnd({
    planId: state.planId,
    periodEnd: state.periodEnd,
    trialEndsAt: state.trialEndsAt,
  });
  const subscriptionCreditsThisPeriod = getSubscriptionCreditsThisPeriod(state);
  const trialCreditsAllowed = getTrialCreditsAllowed(
    {
      trialEndsAt: state.trialEndsAt,
      planId: state.planId,
      trialCreditsBalance: state.trialCreditsBalance ?? 0,
    },
    now,
  );
  const allowedFinal =
    subscriptionCreditsThisPeriod + trialCreditsAllowed + state.addonCreditsBalance;

  const usage = await creditUsage.upsert({
    where: { shop_periodEnd: { shop, periodEnd } },
    create: { shop, periodEnd, creditsUsed: 0 },
    update: {},
  });

  const used = usage.creditsUsed;
  const remaining = Math.max(0, allowedFinal - used);

  return {
    allowed: allowedFinal,
    used,
    remaining,
    isPremiumMusic: state.premiumMusic,
    isPremiumVoices: state.premiumVoices,
    planId: state.planId,
    periodEnd: state.periodEnd,
    trialEndsAt,
    trialEndingSoon,
    trialEnded,
    hasActiveSubscription: !!(state.shopifySubscriptionId || state.stripeSubscriptionId) && !!state.planId,
  };
}

/**
 * Consume 1 credit: use addon balance first (or trial credit during trial), then subscription period usage.
 */
export async function consumeCredit(shop: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const billingState = getBillingState();
  const creditUsage = getCreditUsage();
  const state = await billingState.findUnique({
    where: { shop },
  });
  if (!state) {
    return { ok: false, error: "No billing state" };
  }

  const now = new Date();
  const trialEndsAt = state.trialEndsAt ? new Date(state.trialEndsAt) : null;
  const inTrial = trialEndsAt && now < trialEndsAt && !state.planId;
  const trialCreditsBalance = state.trialCreditsBalance ?? 0;
  const trialCreditsAllowed = getTrialCreditsAllowed(
    { trialEndsAt: state.trialEndsAt, planId: state.planId, trialCreditsBalance },
    now,
  );

  const periodEnd = getEffectivePeriodEnd({
    planId: state.planId,
    periodEnd: state.periodEnd,
    trialEndsAt: state.trialEndsAt,
  });
  const allowedForPeriod = getSubscriptionCreditsThisPeriod(state);

  if (inTrial && trialCreditsBalance > 0 && trialCreditsAllowed > 0) {
    const usage = await creditUsage.upsert({
      where: { shop_periodEnd: { shop, periodEnd } },
      create: { shop, periodEnd, creditsUsed: 1 },
      update: { creditsUsed: { increment: 1 } },
    });
    if (usage.creditsUsed > trialCreditsAllowed) {
      await creditUsage.update({
        where: { shop_periodEnd: { shop, periodEnd } },
        data: { creditsUsed: { decrement: 1 } },
      });
      return { ok: false, error: "No credits remaining" };
    }
    await billingState.update({
      where: { shop },
      data: { trialCreditsBalance: { decrement: 1 } },
    });
    return { ok: true };
  }

  if (state.addonCreditsBalance > 0) {
    await billingState.update({
      where: { shop },
      data: { addonCreditsBalance: { decrement: 1 } },
    });
    return { ok: true };
  }

  const usage = await creditUsage.upsert({
    where: { shop_periodEnd: { shop, periodEnd } },
    create: { shop, periodEnd, creditsUsed: 1 },
    update: { creditsUsed: { increment: 1 } },
  });
  if (usage.creditsUsed > allowedForPeriod) {
    await creditUsage.update({
      where: { shop_periodEnd: { shop, periodEnd } },
      data: { creditsUsed: { decrement: 1 } },
    });
    return { ok: false, error: "No credits remaining" };
  }
  return { ok: true };
}
