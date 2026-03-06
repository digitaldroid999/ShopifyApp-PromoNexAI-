/**
 * Billing status for PromoNexAI (Stripe-based).
 * For subscription UI and credit logic, use getCredits and stripe-billing.server.
 */

import { getCredits } from "./credits.server";

export type BillingStatus = {
  hasActiveSubscription: boolean;
  allowed: number;
  used: number;
  remaining: number;
  planId: string | null;
};

/**
 * Returns billing/credit status for a shop. Use for nav or simple checks.
 */
export async function getBillingStatus(shop: string): Promise<BillingStatus> {
  const credits = await getCredits(shop);
  return {
    hasActiveSubscription: credits.planId != null,
    allowed: credits.allowed,
    used: credits.used,
    remaining: credits.remaining,
    planId: credits.planId,
  };
}
