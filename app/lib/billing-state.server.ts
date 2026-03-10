/**
 * Shared BillingState DB access for billing modules.
 * Used by credits.server (read) and shopify-billing.server (read/write).
 */

import prisma from "../db.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

export function getBillingState() {
  const delegate = prismaAny.billingState;
  if (!delegate) {
    throw new Error("Prisma client missing billingState. Run: npx prisma generate && npx prisma migrate deploy");
  }
  return delegate;
}
