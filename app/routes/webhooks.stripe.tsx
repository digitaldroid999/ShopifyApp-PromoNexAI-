import type { ActionFunctionArgs } from "react-router";
import { getStripe } from "../lib/stripe.server";
import {
  syncBillingStateFromSubscription,
  clearSubscriptionState,
  addAddonCredits,
  priceIdToKey,
  ADDON_CREDITS,
} from "../lib/stripe-billing.server";
import prisma from "../db.server";

const LOG = "[webhooks.stripe]";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    console.error(`${LOG} STRIPE_WEBHOOK_SECRET not set`);
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    console.error(`${LOG} Missing stripe-signature header`);
    return new Response("Missing signature", { status: 400 });
  }

  let event: { type: string; data?: { object?: unknown }; id?: string };
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret) as typeof event;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} Webhook signature verification failed:`, message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data?.object as {
          id: string;
          customer: string;
          current_period_end: number;
          items: { data: Array<{ price: { id: string } }> };
          status?: string;
        } | undefined;
        if (!sub?.customer || !sub.items?.data?.length) break;
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as { id?: string })?.id;
        if (!customerId) break;
        const row = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: customerId },
          select: { shop: true },
        });
        if (!row) {
          console.warn(`${LOG} No shop found for Stripe customer ${customerId}`);
          break;
        }
        if (sub.status === "active" || sub.status === "trialing") {
          await syncBillingStateFromSubscription(row.shop, {
            id: sub.id,
            current_period_end: sub.current_period_end,
            items: sub.items,
          });
          console.log(`${LOG} Synced subscription for shop ${row.shop}`);
        } else {
          await clearSubscriptionState(row.shop);
          console.log(`${LOG} Cleared subscription state for shop ${row.shop} status=${sub.status}`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data?.object as { customer?: string } | undefined;
        const customerId = sub?.customer && typeof sub.customer === "string" ? sub.customer : (sub?.customer as { id?: string })?.id;
        if (!customerId) break;
        const row = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: customerId },
          select: { shop: true },
        });
        if (row) {
          await clearSubscriptionState(row.shop);
          console.log(`${LOG} Cleared subscription (deleted) for shop ${row.shop}`);
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data?.object as {
          subscription?: string | null;
          customer?: string;
          lines?: { data?: Array<{ price?: { id: string }; amount_paid?: number }> };
        } | undefined;
        if (!invoice) break;
        if (invoice.subscription) break;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as { id?: string })?.id;
        if (!customerId) break;
        const row = await prisma.stripeCustomer.findUnique({
          where: { stripeCustomerId: customerId },
          select: { shop: true },
        });
        if (!row) break;
        const line = invoice.lines?.data?.[0];
        const priceId = line?.price?.id;
        if (!priceId) break;
        const key = priceIdToKey(priceId);
        const credits = key ? ADDON_CREDITS[key] : 0;
        if (credits > 0) {
          await addAddonCredits(row.shop, priceId, credits);
          console.log(`${LOG} Added ${credits} addon credits for shop ${row.shop}`);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`${LOG} Error processing ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(undefined, { status: 200 });
};
