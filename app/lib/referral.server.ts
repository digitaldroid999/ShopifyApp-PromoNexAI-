/**
 * App referral: attribute installs via cookie (ref = referrer shop), save Referral row, grant referrer credits.
 */

import prisma from "../db.server";
import { getBillingState } from "./billing-state.server";
import { getEffectivePeriodEnd } from "./credits.server";

const LOG = "[referral]";

export const REFERRAL_COOKIE_NAME = "promonex_ref";
/** 7 days in seconds */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Credits granted to the referrer when a referred merchant installs. */
export const REFERRAL_CREDITS_GRANTED = 2;

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
