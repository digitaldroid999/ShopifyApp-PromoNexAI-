/**
 * Credit logic: getCredits, consumeCredit, free 3 on first use.
 * 1 credit = 1 complete video. Subscription credits reset each period; addon balance does not.
 */

import prisma from "../db.server";

const FREE_CREDITS_INITIAL = 3;
const ADDON_ONLY_PERIOD_END = new Date("2099-12-31T23:59:59Z");

export type CreditsResult = {
  allowed: number;
  used: number;
  remaining: number;
  isPremiumMusic: boolean;
  isPremiumVoices: boolean;
  planId: string | null;
  periodEnd: Date | null;
};

/**
 * Get or create BillingState for shop; grant free 3 credits once.
 * Then return allowed, used, remaining, and premium flags.
 */
export async function getCredits(shop: string): Promise<CreditsResult> {
  let state = await prisma.billingState.findUnique({
    where: { shop },
  });

  if (!state) {
    state = await prisma.billingState.create({
      data: {
        shop,
        addonCreditsBalance: FREE_CREDITS_INITIAL,
        freeCreditsGranted: true,
      },
    });
  } else if (!state.freeCreditsGranted) {
    state = await prisma.billingState.update({
      where: { shop },
      data: {
        freeCreditsGranted: true,
        addonCreditsBalance: { increment: FREE_CREDITS_INITIAL },
      },
    });
  }

  const periodEnd = state.periodEnd ?? ADDON_ONLY_PERIOD_END;
  const allowed = state.subscriptionCreditsPerPeriod + state.addonCreditsBalance;

  let usage = await prisma.creditUsage.findUnique({
    where: {
      shop_periodEnd: { shop, periodEnd },
    },
  });
  if (!usage) {
    usage = await prisma.creditUsage.create({
      data: { shop, periodEnd, creditsUsed: 0 },
    });
  }

  const used = usage.creditsUsed;
  const remaining = Math.max(0, allowed - used);

  return {
    allowed,
    used,
    remaining,
    isPremiumMusic: state.premiumMusic,
    isPremiumVoices: state.premiumVoices,
    planId: state.planId,
    periodEnd: state.periodEnd,
  };
}

/**
 * Consume 1 credit: use addon balance first, then subscription period usage.
 */
export async function consumeCredit(shop: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await prisma.billingState.findUnique({
    where: { shop },
  });
  if (!state) {
    return { ok: false, error: "No billing state" };
  }

  const periodEnd = state.periodEnd ?? ADDON_ONLY_PERIOD_END;

  if (state.addonCreditsBalance > 0) {
    await prisma.billingState.update({
      where: { shop },
      data: { addonCreditsBalance: { decrement: 1 } },
    });
    return { ok: true };
  }

  const usage = await prisma.creditUsage.upsert({
    where: { shop_periodEnd: { shop, periodEnd } },
    create: { shop, periodEnd, creditsUsed: 1 },
    update: { creditsUsed: { increment: 1 } },
  });

  const allowedForPeriod = state.subscriptionCreditsPerPeriod;
  if (usage.creditsUsed > allowedForPeriod) {
    await prisma.creditUsage.update({
      where: { shop_periodEnd: { shop, periodEnd } },
      data: { creditsUsed: { decrement: 1 } },
    });
    return { ok: false, error: "No credits remaining" };
  }
  return { ok: true };
}
