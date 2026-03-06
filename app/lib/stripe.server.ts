/**
 * Stripe client and customer lookup for PromoNexAI billing.
 * Requires STRIPE_SECRET_KEY in env.
 */

import Stripe from "stripe";
import prisma from "../db.server";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret?.trim()) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to your .env file.");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secret);
  }
  return stripeInstance;
}

/**
 * Get or create a Stripe Customer for the given shop.
 * Stores the customer ID in stripe_customers for future Checkout/Portal sessions.
 */
export async function getOrCreateStripeCustomer(shop: string): Promise<string> {
  const existing = await prisma.stripeCustomer.findUnique({
    where: { shop },
    select: { stripeCustomerId: true },
  });
  if (existing) return existing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { shop },
  });

  await prisma.stripeCustomer.create({
    data: {
      shop,
      stripeCustomerId: customer.id,
    },
  });
  return customer.id;
}
