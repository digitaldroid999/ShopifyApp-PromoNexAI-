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
  console.log(`${LOG} webhook step=received topic=${topic} shop=${shop ?? "missing"} payloadKeys=${payload && typeof payload === "object" ? Object.keys(payload as object).join(",") : typeof payload}`);

  if (!shop) {
    console.warn(`${LOG} webhook step=missing_shop topic=${topic}`);
    return new Response("Missing shop", { status: 400 });
  }

  const accessToken = session?.accessToken;
  if (!accessToken) {
    console.warn(`${LOG} webhook step=no_access_token shop=${shop} topic=${topic} skipping sync`);
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
      console.log(`${LOG} webhook step=sync_subscriptions shop=${shop} topic=${topic} payload=${JSON.stringify(payload)}`);
      await syncBillingStateFromShopifyWithToken(shop, accessToken);
      console.log(`${LOG} webhook step=sync_done shop=${shop} topic=${topic}`);
    }

    // One-time purchase accepted: grant addon credits by matching purchase name
    if (
      topic === "APP_PURCHASES_ONE_TIME_UPDATE" ||
      topic === "app_purchases_one_time/update"
    ) {
      const body = (payload ?? {}) as { name?: string; status?: string };
      const name = body?.name ?? "";
      const status = body?.status ?? "";
      console.log(`${LOG} webhook step=one_time_purchase shop=${shop} topic=${topic} name=${name} status=${status} fullPayload=${JSON.stringify(payload)}`);
      if (status === "ACTIVE" || status === "active") {
        for (const [addonKey, pricing] of Object.entries(ADDON_PRICING)) {
          if (pricing.name === name || name.includes(pricing.name) || name.includes(addonKey)) {
            const credits = ADDON_CREDITS[addonKey] ?? 0;
            if (credits > 0) {
              await addAddonCredits(shop, addonKey, credits);
              console.log(`${LOG} webhook step=addon_granted shop=${shop} addonKey=${addonKey} credits=${credits}`);
            }
            break;
          }
        }
      } else {
        console.log(`${LOG} webhook step=one_time_purchase_skip shop=${shop} status=${status} (not ACTIVE)`);
      }
    }
  } catch (err) {
    console.error(`${LOG} webhook step=error shop=${shop} topic=${topic}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(undefined, { status: 200 });
};
