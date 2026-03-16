/**
 * App referral: attribute installs via cookie (ref = referrer shop), save Referral row, grant referrer credits.
 * Referrer reward = 20% of referred user's first payment (first payment is 90% of plan price for referred users). Eligible 30 days later; min $20 to request payout.
 */

import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../db.server";
import { getBillingState } from "./billing-state.server";
import { getEffectivePeriodEnd } from "./credits.server";
import { PLAN_PRICING } from "./shopify-billing.server";

const LOG = "[referral]";

export const REFERRAL_COOKIE_NAME = "promonex_ref";
/** 7 days in seconds */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Credits granted to the referrer when a referred merchant installs. */
export const REFERRAL_CREDITS_GRANTED = 2;

/** Referrer reward = this fraction of the referred user's first payment (referred user pays 90% of plan price, referrer gets 20% of that). */
export const REFERRER_REWARD_PERCENT_OF_FIRST_PAYMENT = 0.2;

/** Minimum balance (USD) to request a payout. */
export const REFERRER_MIN_PAYOUT_USD = 20;

/** Days after referred shop's first payment before referrer reward becomes eligible (aligns with Shopify payout). */
export const REFERRER_ELIGIBILITY_DAYS = 30;

/** Normalize ref to referrer shop: lowercase, must look like a shop domain (e.g. *.myshopify.com). */
function normalizeRefToReferrerShop(ref: string | null): string | null {
  const raw = ref?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.endsWith(".myshopify.com")) return lower;
  return null;
}

/**
 * Grant referral credits to referrer shop (add to addonCreditsBalance, same pattern as addAddonCredits).
 */
export async function grantReferralCredits(shop: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const billingState = getBillingState();
  const state = await billingState.findUnique({ where: { shop } });
  const addonCreditsValidForPeriodEnd = state
    ? getEffectivePeriodEnd({
        planId: state.planId,
        periodEnd: state.periodEnd,
        trialEndsAt: state.trialEndsAt,
      })
    : null;
  await billingState.upsert({
    where: { shop },
    create: { shop, addonCreditsBalance: amount, addonCreditsValidForPeriodEnd: null },
    update: {
      addonCreditsBalance: { increment: amount },
      addonCreditsValidForPeriodEnd,
    },
  });
  console.log(`${LOG} grantReferralCredits shop=${shop} amount=${amount}`);
}

export type AttributeResult = { clearReferralCookie: true } | { clearReferralCookie?: false };

/** True if this shop was referred (exists as referredShop in Referral). Used for 10% off first payment. */
export async function isShopReferred(shop: string): Promise<boolean> {
  const referral = await prisma.referral.findUnique({ where: { referredShop: shop } });
  return !!referral;
}

/**
 * If this shop is referred and has an active subscription plan but we haven't recorded first payment yet, record it.
 * Call after syncing billing (e.g. subscription webhook or subscription page loader after approval).
 */
export async function ensureReferredFirstPaymentRecorded(referredShop: string, planId: string | null): Promise<void> {
  if (!planId) return;
  const referral = await prisma.referral.findUnique({ where: { referredShop } });
  if (!referral || referral.referredFirstPaymentAt != null) return;
  const isSubscriptionPlan =
    planId === "starter_monthly" ||
    planId === "starter_yearly" ||
    planId === "pro_monthly" ||
    planId === "pro_yearly" ||
    planId === "business_monthly" ||
    planId === "business_yearly";
  if (!isSubscriptionPlan) return;
  await recordReferredFirstPayment(referredShop, planId);
}

/**
 * Record referred shop's first subscription payment and set referrer reward (USD) and eligibility date (first payment + 30 days).
 * Call when the referred shop has an active subscription and we haven't recorded yet.
 */
export async function recordReferredFirstPayment(referredShop: string, planId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({ where: { referredShop } });
  if (!referral || referral.referredFirstPaymentAt != null) return;

  const planPricing = PLAN_PRICING[planId];
  if (!planPricing) return;
  const firstPaymentAmount = Math.round(planPricing.amount * 0.9 * 100) / 100;
  const rewardUsd = Math.round(firstPaymentAmount * REFERRER_REWARD_PERCENT_OF_FIRST_PAYMENT * 100) / 100;
  if (rewardUsd <= 0) return;

  const now = new Date();
  const eligibleAt = new Date(now);
  eligibleAt.setDate(eligibleAt.getDate() + REFERRER_ELIGIBILITY_DAYS);

  await prisma.referral.update({
    where: { referredShop },
    data: {
      referredFirstPaymentAt: now,
      referredPlanId: planId,
      referrerRewardAmount: new Decimal(rewardUsd),
      referrerRewardEligibleAt: eligibleAt,
    },
  });
  console.log(`${LOG} recordReferredFirstPayment referredShop=${referredShop} planId=${planId} firstPayment=${firstPaymentAmount} rewardUsd=${rewardUsd} eligibleAt=${eligibleAt.toISOString()}`);
}

/** List all referrals where this shop is the referrer (for referral page). */
export async function getReferrerReferrals(referrerShop: string) {
  const list = await prisma.referral.findMany({
    where: { referrerShop },
    orderBy: { createdAt: "desc" },
  });
  return list.map((r) => ({
    id: r.id,
    referredShop: r.referredShop,
    createdAt: r.createdAt,
    referredFirstPaymentAt: r.referredFirstPaymentAt,
    referredPlanId: r.referredPlanId,
    referrerRewardAmount: r.referrerRewardAmount ? Number(r.referrerRewardAmount) : null,
    referrerRewardEligibleAt: r.referrerRewardEligibleAt,
    referrerRewardPaidAt: r.referrerRewardPaidAt,
  }));
}

/** Sum of unpaid eligible reward amounts (USD) for this referrer. Eligible = referrerRewardEligibleAt <= now and referrerRewardPaidAt is null. */
export async function getReferrerEligibleBalance(referrerShop: string): Promise<number> {
  const now = new Date();
  const rows = await prisma.referral.findMany({
    where: {
      referrerShop,
      referrerRewardEligibleAt: { lte: now },
      referrerRewardPaidAt: null,
      referrerRewardAmount: { not: null },
    },
  });
  let sum = 0;
  for (const r of rows) {
    if (r.referrerRewardAmount) sum += Number(r.referrerRewardAmount);
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Create a payout request for the referrer. Deducts eligible unpaid rewards (sets referrerRewardPaidAt) and creates a ReferralPayout (pending).
 * Returns { success: true, amount } or { error: string }. Requires balance >= REFERRER_MIN_PAYOUT_USD.
 */
export async function requestReferrerPayout(referrerShop: string): Promise<{ success: true; amount: number } | { error: string }> {
  const balance = await getReferrerEligibleBalance(referrerShop);
  if (balance < REFERRER_MIN_PAYOUT_USD) {
    return { error: `Minimum payout is $${REFERRER_MIN_PAYOUT_USD}. Your eligible balance is $${balance.toFixed(2)}.` };
  }

  const now = new Date();
  const rows = await prisma.referral.findMany({
    where: {
      referrerShop,
      referrerRewardEligibleAt: { lte: now },
      referrerRewardPaidAt: null,
      referrerRewardAmount: { not: null },
    },
  });

  const amount = rows.reduce((s, r) => s + (r.referrerRewardAmount ? Number(r.referrerRewardAmount) : 0), 0);
  const amountRounded = Math.round(amount * 100) / 100;

  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.referral.update({
        where: { id: r.id },
        data: { referrerRewardPaidAt: now },
      })
    ),
    prisma.referralPayout.create({
      data: {
        referrerShop,
        amount: new Decimal(amountRounded),
        currency: "USD",
        status: "pending",
      },
    }),
  ]);

  console.log(`${LOG} requestReferrerPayout referrerShop=${referrerShop} amount=${amountRounded} referralsCount=${rows.length}`);
  return { success: true, amount: amountRounded };
}

/**
 * If request has referral cookie and this shop is not yet attributed, create Referral row, grant credits to referrer, return clearReferralCookie.
 * Call from app layout loader after authenticate + getCredits.
 */
export async function attributeReferralIfNeeded(
  referredShop: string,
  request: Request
): Promise<AttributeResult> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${REFERRAL_COOKIE_NAME}=([^;]+)`));
  const ref = match?.[1] ? decodeURIComponent(match[1].trim()) : null;
  const referrerShop = normalizeRefToReferrerShop(ref);

  console.log(`${LOG} attributeReferralIfNeeded referredShop=${referredShop} hasCookie=${!!match} ref=${ref ?? "null"} referrerShop=${referrerShop ?? "null"}`);

  if (!referrerShop) {
    if (ref !== null) {
      return { clearReferralCookie: true };
    }
    return {};
  }

  if (referrerShop === referredShop.toLowerCase()) {
    return { clearReferralCookie: true };
  }

  const existing = await prisma.referral.findUnique({ where: { referredShop } });
  if (existing) {
    return { clearReferralCookie: true };
  }

  try {
    await prisma.referral.create({
      data: { referrerShop, referredShop },
    });
    await grantReferralCredits(referrerShop, REFERRAL_CREDITS_GRANTED);
    console.log(`${LOG} attributed referredShop=${referredShop} referrerShop=${referrerShop}`);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return { clearReferralCookie: true };
    }
    throw e;
  }

  return { clearReferralCookie: true };
}
