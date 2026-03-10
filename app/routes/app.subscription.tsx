import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getCredits } from "../lib/credits.server";
import {
  createSubscription,
  createOneTimePurchase,
  cancelSubscription,
  getSubscriptionDetails,
  syncBillingStateFromShopify,
  addAddonCredits,
} from "../lib/shopify-billing.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const PLAN_LABELS: Record<string, string> = {
  starter_monthly: "Starter Monthly",
  starter_yearly: "Starter Yearly",
  pro_monthly: "Professional Monthly",
  pro_yearly: "Professional Yearly",
  business_monthly: "Business Monthly",
  business_yearly: "Business Yearly",
};

/**
 * Build return URLs for Shopify billing so redirects open the app inside Shopify Admin (with session).
 * Set SHOPIFY_APP_HANDLE in .env to your app's handle (see Admin URL when opening the app: .../apps/{handle}).
 */
function getSubscriptionReturnUrls(shop: string, fallbackOrigin: string, addonKey?: string): { successUrl: string; cancelUrl: string } {
  const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim();
  const approved = addonKey ? `approved=1&addon=${encodeURIComponent(addonKey)}` : "approved=1";
  if (appHandle) {
    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const base = `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`;
    return {
      successUrl: `${base}/app/subscription?${approved}`,
      cancelUrl: `${base}/app/subscription`,
    };
  }
  const appUrl = process.env.SHOPIFY_APP_URL?.trim() ?? "";
  const origin = fallbackOrigin || (appUrl ? (appUrl.startsWith("http") ? appUrl : `https://${appUrl}`).replace(/\/$/, "") : "");
  if (origin) {
    return {
      successUrl: `${origin}/app/subscription?${approved}`,
      cancelUrl: `${origin}/app/subscription`,
    };
  }
  return { successUrl: "", cancelUrl: "" };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop ?? "";
  const url = new URL(request.url);
  const approved = url.searchParams.get("approved") === "1";
  const addonKey = url.searchParams.get("addon") ?? null;

  if (shop && approved && admin) {
    await syncBillingStateFromShopify(admin, shop);
    if (addonKey && ["addon_10", "addon_25", "addon_50"].includes(addonKey)) {
      await addAddonCredits(shop, addonKey);
    }
  }

  const [credits, subscriptionDetails] = shop
    ? await Promise.all([getCredits(shop), getSubscriptionDetails(shop)])
    : [null, null];
  const activeSubscriptionId = subscriptionDetails?.shopifySubscriptionId ?? null;

  return {
    shop,
    credits,
    subscriptionDetails,
    hasActiveSubscription: !!subscriptionDetails?.hasActiveSubscription,
    activeSubscriptionId,
    approved,
  };
};

// Test mode: use for dev stores. No real charges. Requires Partner Dashboard → App → Distribution = "Shopify Store" (not "No distribution").
const isTest =
  process.env.SHOPIFY_BILLING_TEST === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.SHOPIFY_BILLING_TEST !== "false");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop ?? "";
  if (!shop) return { error: "Session missing shop" };

  const formData = await request.formData();
  const intent = formData.get("intent") as string | null;
  const origin = new URL(request.url).origin;

  if (intent === "cancel") {
    const subscriptionId = formData.get("subscriptionId") as string | null;
    if (!subscriptionId) return { error: "No subscription to cancel" };
    const result = await cancelSubscription(admin, subscriptionId);
    if (result.error) return { error: result.error };
    return { cancelled: true };
  }

  const { successUrl } = getSubscriptionReturnUrls(shop, origin);

  if (intent === "checkout_subscription") {
    const planKey = formData.get("planKey") as string | null;
    if (!planKey) return { error: "Invalid plan" };
    const result = await createSubscription({
      admin,
      shop,
      planKey,
      returnUrl: successUrl,
      test: isTest,
    });
    if ("error" in result && result.error) return { error: result.error };
    if ("url" in result && result.url) return { redirectUrl: result.url };
    return { error: "Could not create subscription" };
  }

  if (intent === "checkout_addon") {
    const addonKey = formData.get("addonKey") as string | null;
    if (!addonKey) return { error: "Invalid addon" };
    const { successUrl: addonReturnUrl } = getSubscriptionReturnUrls(shop, origin, addonKey);
    const result = await createOneTimePurchase({
      admin,
      addonKey,
      returnUrl: addonReturnUrl,
      test: isTest,
    });
    if ("error" in result && result.error) return { error: result.error };
    if ("url" in result && result.url) return { redirectUrl: result.url };
    return { error: "Could not create purchase" };
  }

  if (intent === "checkout_premium") {
    const premiumKey = formData.get("premiumKey") as string | null;
    if (!premiumKey || (premiumKey !== "premium_music" && premiumKey !== "premium_voices")) return { error: "Invalid premium add-on" };
    const result = await createSubscription({
      admin,
      shop,
      planKey: premiumKey,
      returnUrl: successUrl,
      test: isTest,
    });
    if ("error" in result && result.error) return { error: result.error };
    if ("url" in result && result.url) return { redirectUrl: result.url };
    return { error: "Could not create premium subscription" };
  }

  return { error: "Invalid action" };
};

/**
 * Skip revalidation when URL is unchanged (e.g. focus in embedded iframe).
 * Stops repeated GET /app/subscription.data and "Authenticating admin request" logs.
 */
export function shouldRevalidate(args: {
  currentUrl: URL;
  nextUrl: URL;
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}): boolean {
  if (args.formMethod) return true;
  if (args.currentUrl.pathname === args.nextUrl.pathname && args.currentUrl.search === args.nextUrl.search) return false;
  return args.defaultShouldRevalidate;
}

export default function SubscriptionPage() {
  const { shop, credits, subscriptionDetails, hasActiveSubscription, activeSubscriptionId, approved } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData?.error;
  const redirectUrl = actionData && "redirectUrl" in actionData ? actionData.redirectUrl : undefined;
  return (
    <s-page heading="Subscription">
      {redirectUrl && (
        <div
          style={{
            marginBottom: "16px",
            padding: "16px 20px",
            background: "var(--p-color-bg-fill-info-secondary, #e3f1ff)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-info, #2c6ecb)",
          }}
        >
          <s-text type="strong">Continue to billing</s-text>
          <p style={{ margin: "8px 0 12px", fontSize: "14px", color: "var(--p-color-text-secondary, #6d7175)" }}>
            Click the button below to complete your subscription on Shopify. Do not refresh the billing page—if you see &quot;This feature isn&apos;t currently available,&quot; return here and choose your plan again to get a new link.
          </p>
          <a
            href={redirectUrl}
            target="_top"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: "8px",
              background: "var(--p-color-bg-fill-info, #2c6ecb)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Go to Shopify billing
          </a>
        </div>
      )}
      {actionData && "cancelled" in actionData && actionData.cancelled && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "var(--p-color-bg-fill-success-secondary, #d3f0d9)",
            borderRadius: "8px",
            color: "var(--p-color-text-success, #008060)",
          }}
        >
          <s-text type="strong">Subscription cancelled.</s-text> Your plan has been cancelled.
        </div>
      )}
      {approved && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            background: "var(--p-color-bg-fill-success-secondary, #d3f0d9)",
            borderRadius: "8px",
            color: "var(--p-color-text-success, #008060)",
          }}
        >
          <s-text type="strong">Success.</s-text> Your billing has been updated. You can close this and continue using the app.
        </div>
      )}

      {(credits || subscriptionDetails) && (
        <s-section heading="Current subscription & credits">
          <div
            style={{
              padding: "20px",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              borderRadius: "12px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              marginBottom: "24px",
            }}
          >
            {/* Plan & period */}
            <div style={{ marginBottom: "16px" }}>
              <s-text type="strong">
                {subscriptionDetails?.hasActiveSubscription && subscriptionDetails.planId
                  ? PLAN_LABELS[subscriptionDetails.planId] ?? subscriptionDetails.planId
                  : "No subscription plan"}
              </s-text>
              {subscriptionDetails?.periodEnd && (
                <div style={{ marginTop: "4px" }}>
                  <s-text color="subdued">
                    {subscriptionDetails.hasActiveSubscription ? "Current period ends: " : "Add-on credits period: "}
                    {new Date(subscriptionDetails.periodEnd).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </s-text>
                </div>
              )}
            </div>

            {/* Credits breakdown */}
            {subscriptionDetails && (
              <div
                style={{
                  padding: "12px 0",
                  borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <s-text type="strong">Credits</s-text>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {subscriptionDetails.subscriptionCreditsPerPeriod > 0 && (
                    <s-text color="subdued">
                      From plan this period: {subscriptionDetails.subscriptionCreditsPerPeriod} videos
                    </s-text>
                  )}
                  <s-text color="subdued">
                    Add-on balance: {subscriptionDetails.addonCreditsBalance} videos (do not expire)
                  </s-text>
                  {credits && (
                    <div style={{ marginTop: "4px" }}>
                      <s-text color="subdued">Total available: {credits.allowed} videos</s-text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Used / remaining */}
            {credits && (
              <div style={{ marginTop: "16px" }}>
                {!subscriptionDetails && (
                  <div style={{ marginBottom: "4px" }}>
                    <s-text color="subdued">Total available: {credits.allowed} videos</s-text>
                  </div>
                )}
                <s-text type="strong">
                  Used this period: {credits.used} / {credits.allowed} videos
                </s-text>
                <div style={{ marginTop: "2px" }}>
                  <s-text color="subdued">{credits.remaining} remaining</s-text>
                </div>
                {credits.remaining <= 0 && (
                  <div style={{ marginTop: "8px", color: "var(--p-color-text-critical, #d72c0d)" }}>
                    <s-text>
                      No credits left. Upgrade or buy add-on credits to create more videos.
                    </s-text>
                  </div>
                )}
              </div>
            )}

            {/* Premium add-ons */}
            {(subscriptionDetails?.premiumMusic || subscriptionDetails?.premiumVoices) && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)" }}>
                <div style={{ marginBottom: "6px" }}>
                  <s-text type="strong">Premium add-ons</s-text>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {subscriptionDetails.premiumMusic && (
                    <span
                      style={{
                        padding: "4px 10px",
                        background: "var(--p-color-bg-fill-success-secondary, #d3f0d9)",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Premium Music
                    </span>
                  )}
                  {subscriptionDetails.premiumVoices && (
                    <span
                      style={{
                        padding: "4px 10px",
                        background: "var(--p-color-bg-fill-success-secondary, #d3f0d9)",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Premium Voices
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </s-section>
      )}

      {hasActiveSubscription && activeSubscriptionId && (
        <s-section heading="Manage billing">
          <Form method="post" action="/app/subscription">
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="subscriptionId" value={activeSubscriptionId} />
            <s-button type="submit" variant="secondary">Cancel plan</s-button>
          </Form>
        </s-section>
      )}

      <s-section heading="Plans">
        <div style={{ marginBottom: "16px" }}>
          <s-paragraph color="subdued">
            Subscribe to get monthly credits. 1 credit = 1 complete video (all scenes + voice + music + export). Unused credits do not carry over.
          </s-paragraph>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              background: "var(--p-color-bg-fill-critical-secondary, #fbeae5)",
              borderRadius: "8px",
              color: "var(--p-color-text-critical, #d72c0d)",
            }}
          >
            <s-text>{error}</s-text>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
          <PlanCard planKey="starter_monthly" price="$49" period="/month" videos="10 videos" currentPlanId={subscriptionDetails?.planId ?? null} />
          <PlanCard planKey="starter_yearly" price="$470" period="/year" videos="10 videos/month (save $118)" currentPlanId={subscriptionDetails?.planId ?? null} />
          <PlanCard planKey="pro_monthly" price="$99" period="/month" videos="30 videos" highlighted currentPlanId={subscriptionDetails?.planId ?? null} />
          <PlanCard planKey="pro_yearly" price="$950" period="/year" videos="30 videos/month (save $238)" currentPlanId={subscriptionDetails?.planId ?? null} />
          <PlanCard planKey="business_monthly" price="$199" period="/month" videos="75 videos" currentPlanId={subscriptionDetails?.planId ?? null} />
          <PlanCard planKey="business_yearly" price="$1,910" period="/year" videos="75 videos/month (save $478)" currentPlanId={subscriptionDetails?.planId ?? null} />
        </div>
      </s-section>

      <s-section heading="Add credits (one-time)">
        <s-paragraph color="subdued">Add more videos immediately. Credits do not expire.</s-paragraph>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
          <AddonButton addonKey="addon_10" label="Extra 10 credits — $39" />
          <AddonButton addonKey="addon_25" label="Extra 25 credits — $79" />
          <AddonButton addonKey="addon_50" label="Extra 50 credits — $149" />
        </div>
      </s-section>

      <s-section heading="Premium add-ons">
        <s-paragraph color="subdued">Feature unlocks. Same credit cost per video.</s-paragraph>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
          <PremiumButton premiumKey="premium_music" label="Premium Music Library — $9/month (10,000 tracks)" />
          <PremiumButton premiumKey="premium_voices" label="Premium Voices — $15/month (50 voices)" />
        </div>
      </s-section>

      <s-section slot="aside" heading="Billing">
        <s-paragraph color="subdued">
          Billing is handled securely by Shopify. You can cancel your plan at any time via the button above.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

function PlanCard({
  planKey,
  price,
  period,
  videos,
  highlighted,
  currentPlanId,
}: {
  planKey: string;
  price: string;
  period: string;
  videos: string;
  highlighted?: boolean;
  currentPlanId?: string | null;
}) {
  const name = PLAN_LABELS[planKey] ?? planKey;
  const isCurrentPlan = !!currentPlanId && currentPlanId === planKey;
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: isCurrentPlan ? "2px solid var(--p-color-border-success, #008060)" : highlighted ? "2px solid var(--p-color-border-info, #2c6ecb)" : "1px solid var(--p-color-border-secondary, #e1e3e5)",
        background: isCurrentPlan ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)" : highlighted ? "var(--p-color-bg-surface-selected, #f1f8ff)" : "var(--p-color-bg-surface-primary, #fff)",
        position: "relative",
      }}
    >
      {isCurrentPlan && (
        <span
          style={{
            position: "absolute",
            top: "-1px",
            right: "12px",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 600,
            background: "var(--p-color-bg-fill-success, #008060)",
            color: "#fff",
            borderRadius: "0 0 8px 8px",
          }}
        >
          Current plan
        </span>
      )}
      {highlighted && !isCurrentPlan && (
        <span
          style={{
            position: "absolute",
            top: "-1px",
            right: "12px",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 600,
            background: "var(--p-color-bg-fill-info, #2c6ecb)",
            color: "#fff",
            borderRadius: "0 0 8px 8px",
          }}
        >
          Most popular
        </span>
      )}
      <s-text type="strong">{name}</s-text>
      <div style={{ marginTop: "8px", marginBottom: "12px" }}>
        <span style={{ fontSize: "24px", fontWeight: 700 }}>{price}</span>
        <s-text color="subdued">{period}</s-text>
      </div>
      <s-paragraph color="subdued">{videos}</s-paragraph>
      <div style={{ marginTop: "16px" }}>
        {isCurrentPlan ? (
          <s-button variant="secondary" disabled>Current plan</s-button>
        ) : (
          <Form method="post" action="/app/subscription">
            <input type="hidden" name="intent" value="checkout_subscription" />
            <input type="hidden" name="planKey" value={planKey} />
            <s-button type="submit" variant={highlighted ? "primary" : "secondary"}>
              Subscribe
            </s-button>
          </Form>
        )}
      </div>
    </div>
  );
}

function AddonButton({ addonKey, label }: { addonKey: string; label: string }) {
  return (
    <Form method="post" action="/app/subscription">
      <input type="hidden" name="intent" value="checkout_addon" />
      <input type="hidden" name="addonKey" value={addonKey} />
      <s-button type="submit" variant="secondary">{label}</s-button>
    </Form>
  );
}

function PremiumButton({ premiumKey, label }: { premiumKey: string; label: string }) {
  return (
    <Form method="post" action="/app/subscription">
      <input type="hidden" name="intent" value="checkout_premium" />
      <input type="hidden" name="premiumKey" value={premiumKey} />
      <s-button type="submit" variant="secondary">{label}</s-button>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
