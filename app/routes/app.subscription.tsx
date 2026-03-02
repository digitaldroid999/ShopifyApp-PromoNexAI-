import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getBillingStatus, createAppSubscription, SUBSCRIPTION_PLANS } from "../lib/billing.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const billing = await getBillingStatus(admin);
  const url = new URL(request.url);
  const approved = url.searchParams.get("approved") === "1";
  return {
    ...billing,
    plans: SUBSCRIPTION_PLANS,
    approved,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "createSubscription") {
    return { error: "Invalid action" };
  }

  const planId = formData.get("planId") as string | null;
  if (!planId) {
    return { error: "Please select a plan" };
  }

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { error: "Invalid plan" };
  }

  const baseUrl = new URL(request.url).origin;
  const returnUrl = `${baseUrl}/app/subscription?approved=1`;

  const isTest =
    process.env.NODE_ENV !== "production" ||
    process.env.SHOPIFY_BILLING_TEST === "true";

  const result = await createAppSubscription(admin, {
    name: plan.name,
    returnUrl,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval: plan.interval,
            price: { amount: plan.price, currencyCode: plan.currencyCode },
          },
        },
      },
    ],
    test: isTest,
  });

  if (!result.success) {
    const message = result.userErrors?.map((e) => e.message).join(", ") ?? result.userErrors?.[0]?.message ?? "Failed to create subscription";
    return { error: message };
  }

  if (result.confirmationUrl) {
    throw redirect(result.confirmationUrl);
  }

  return { error: "No confirmation URL received" };
};

export default function SubscriptionPage() {
  const { hasActiveSubscription, activeSubscriptions, plans, approved } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData?.error;

  return (
    <s-page heading="Subscription">
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
          <s-text type="strong">Subscription approved.</s-text> You now have access to your plan. You can close this and continue using the app.
        </div>
      )}

      {hasActiveSubscription && activeSubscriptions.length > 0 && (
        <s-section heading="Current plan">
          <div
            style={{
              padding: "16px",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              borderRadius: "8px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              marginBottom: "24px",
            }}
          >
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} style={{ marginBottom: sub.id !== activeSubscriptions[activeSubscriptions.length - 1]?.id ? "12px" : 0 }}>
                <s-text type="strong">{sub.name}</s-text>
                <span
                  style={{
                    marginLeft: "8px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background:
                      sub.status === "ACTIVE"
                        ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)"
                        : "var(--p-color-bg-fill-caution-secondary, #fcf1e0)",
                    color:
                      sub.status === "ACTIVE"
                        ? "var(--p-color-text-success, #008060)"
                        : "var(--p-color-text-caution, #b98900)",
                  }}
                >
                  {sub.status}
                </span>
                {sub.lineItems.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    {sub.lineItems.map((li) => (
                      <s-text key={li.id} color="subdued">
                        {li.plan.price.currencyCode} {li.plan.price.amount} / {li.plan.interval === "EVERY_30_DAYS" ? "month" : "year"}
                      </s-text>
                    ))}
                  </div>
                )}
                {sub.currentPeriodEnd && (
                  <div style={{ display: "block", marginTop: "4px" }}>
                    <s-text color="subdued">
                      Current period ends: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </s-text>
                  </div>
                )}
              </div>
            ))}
          </div>
        </s-section>
      )}

      <s-section heading={hasActiveSubscription ? "Change plan" : "Choose a plan"}>
        <div style={{ marginBottom: "24px" }}>
          <s-paragraph color="subdued">
            {hasActiveSubscription
              ? "Select a new plan below. Your existing subscription will be replaced after confirmation."
              : "Subscribe to create promo videos. Billing is handled securely through Shopify."}
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                padding: "24px",
                borderRadius: "12px",
                border: plan.highlighted
                  ? "2px solid var(--p-color-border-info, #2c6ecb)"
                  : "1px solid var(--p-color-border-secondary, #e1e3e5)",
                background: plan.highlighted
                  ? "var(--p-color-bg-surface-selected, #f1f8ff)"
                  : "var(--p-color-bg-surface-primary, #fff)",
                position: "relative",
              }}
            >
              {plan.highlighted && (
                <span
                  style={{
                    position: "absolute",
                    top: "-1px",
                    right: "16px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    borderRadius: "0 0 8px 8px",
                  }}
                >
                  Popular
                </span>
              )}
              <div style={{ fontSize: "18px" }}>
                <s-text type="strong">{plan.name}</s-text>
              </div>
              <div style={{ marginTop: "4px", marginBottom: "16px" }}>
                <s-paragraph color="subdued">{plan.description}</s-paragraph>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "28px", fontWeight: 700 }}>
                  ${plan.price}
                </span>
                <s-text color="subdued">/month</s-text>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 20px 0",
                  fontSize: "14px",
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      padding: "4px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ color: "var(--p-color-text-success, #008060)" }}>✓</span>
                    <s-text>{f}</s-text>
                  </li>
                ))}
              </ul>
              <Form method="post" action="/app/subscription" target="_top">
                <input type="hidden" name="intent" value="createSubscription" />
                <input type="hidden" name="planId" value={plan.id} />
                <s-button type="submit" variant={plan.highlighted ? "primary" : "secondary"}>
                  {hasActiveSubscription ? "Switch to this plan" : "Subscribe"}
                </s-button>
              </Form>
            </div>
          ))}
        </div>
      </s-section>

      <s-section slot="aside" heading="Billing">
        <s-paragraph color="subdued">
          You can cancel or change your plan at any time from your Shopify admin billing page. Charges appear on your Shopify bill.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
