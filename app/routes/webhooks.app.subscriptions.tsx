import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  syncBillingStateFromShopifyWithToken,
  addAddonCredits,
  ADDON_CREDITS,
  ADDON_PRICING,
} from "../lib/shopify-billing.server";

const LOG = "[webhooks.app.subscriptions]";

/**
 * Handles Shopify app billing webhooks: subscription updates/deletes and one-time purchase updates.
 * Syncs BillingState from currentAppInstallation when subscriptions change; grants addon credits when one-time purchase is accepted.
 * Subscribe to topics in Partner Dashboard or app config (e.g. app_subscriptions/update, app_subscriptions/delete, app_purchases_one_time/update).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { shop, session, topic, payload } = await authenticate.webhook(request);
  if (!shop) {
    return new Response("Missing shop", { status: 400 });
  }

  const accessToken = session?.accessToken;
  if (!accessToken) {
    console.warn(`${LOG} No session/accessToken for shop ${shop}, skipping sync`);
    return new Response(undefined, { status: 200 });
  }

  try {
    // Subscription lifecycle: re-sync from Shopify so BillingState matches active subscriptions
    if (
      topic === "APP_SUBSCRIPTIONS_UPDATE" ||
      topic === "app_subscriptions/update" ||
      topic === "APP_SUBSCRIPTIONS_DELETE" ||
      topic === "app_subscriptions/delete"
    ) {
      await syncBillingStateFromShopifyWithToken(shop, accessToken);
      console.log(`${LOG} Synced billing for ${shop} (${topic})`);
    }

    // One-time purchase accepted: grant addon credits by matching purchase name
    if (
      topic === "APP_PURCHASES_ONE_TIME_UPDATE" ||
      topic === "app_purchases_one_time/update"
    ) {
      const body = (payload ?? {}) as { name?: string; status?: string };
      const name = body?.name ?? "";
      const status = body?.status ?? "";
      if (status === "ACTIVE" || status === "active") {
        for (const [addonKey, pricing] of Object.entries(ADDON_PRICING)) {
          if (pricing.name === name || name.includes(pricing.name) || name.includes(addonKey)) {
            const credits = ADDON_CREDITS[addonKey] ?? 0;
            if (credits > 0) {
              await addAddonCredits(shop, addonKey, credits);
              console.log(`${LOG} Added ${credits} addon credits for ${shop} (${addonKey})`);
            }
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error(`${LOG} Error processing ${topic} for ${shop}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(undefined, { status: 200 });
};
