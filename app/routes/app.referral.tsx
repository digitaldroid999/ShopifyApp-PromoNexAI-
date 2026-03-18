import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getReferrerReferrals,
  getReferrerEligibleBalance,
  requestReferrerPayout,
  REFERRER_MIN_PAYOUT_USD,
  REFERRER_ELIGIBILITY_DAYS,
} from "../lib/referral.server";

/** Ensure URL uses https (referral link must be https for sharing). */
function ensureHttps(url: string): string {
  const trimmed = url.replace(/\/$/, "").trim();
  if (trimmed.toLowerCase().startsWith("http://")) return "https://" + trimmed.slice(7);
  if (!trimmed.toLowerCase().startsWith("https://")) return "https://" + trimmed;
  return trimmed;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const origin = new URL(request.url).origin;
  const appUrl = process.env.SHOPIFY_APP_URL?.trim();
  const baseRaw = origin || (appUrl?.startsWith("http") ? appUrl : appUrl ? `https://${appUrl}` : "") || "";
  const base = ensureHttps(baseRaw);
  const referralLink = `${base.replace(/\/$/, "")}/invite?ref=${encodeURIComponent(shop)}`;

  const [referrals, eligibleBalance] = shop
    ? await Promise.all([getReferrerReferrals(shop), getReferrerEligibleBalance(shop)])
    : [[], 0];

  return {
    shop,
    referralLink,
    referrals,
    eligibleBalance,
    minPayoutUsd: REFERRER_MIN_PAYOUT_USD,
    eligibilityDays: REFERRER_ELIGIBILITY_DAYS,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) return { error: "Session missing shop" };

  const formData = await request.formData();
  if (formData.get("intent") !== "request_payout") return { error: "Invalid action" };

  const result = await requestReferrerPayout(shop);
  if ("error" in result) return { error: result.error };
  return { success: true, amount: result.amount };
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function statusLabel(r: {
  referredFirstPaymentAt: Date | null;
  referrerRewardEligibleAt: Date | null;
  referrerRewardPaidAt: Date | null;
}): string {
  if (r.referrerRewardPaidAt) return "Paid";
  if (r.referrerRewardEligibleAt) {
    const eligible = new Date(r.referrerRewardEligibleAt) <= new Date();
    return eligible ? "Eligible" : `Eligible ${formatDate(r.referrerRewardEligibleAt)}`;
  }
  if (r.referredFirstPaymentAt) return "Subscribed";
  return "Installed";
}

export default function ReferralPage() {
  const { referralLink, referrals, eligibleBalance, minPayoutUsd, eligibilityDays } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const canRequestPayout = eligibleBalance >= minPayoutUsd;

  return (
    <s-page heading="Referral">
      <s-section heading="Your referral link">
        <s-paragraph>
          Share this link with other merchants. When they install and subscribe, you earn a one-time cash reward: Starter $5 (monthly) / $15 (yearly), Professional $15 / $40, Business $30 / $75. Payout is available about {eligibilityDays} days after their first payment, with a ${minPayoutUsd} minimum balance to request, via PayPal or Stripe.
        </s-paragraph>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <input
            type="text"
            readOnly
            value={referralLink}
            style={{
              flex: "1",
              minWidth: "200px",
              padding: "10px 12px",
              fontSize: "14px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              borderRadius: "8px",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
            }}
            aria-label="Referral link"
          />
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              borderRadius: "8px",
              background: copied
                ? "var(--p-color-bg-fill-success, #008060)"
                : "var(--p-color-bg-fill-brand, #008060)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </s-section>

      <s-section heading="Reward balance">
        <s-paragraph color="subdued">
          Eligible balance is the sum of unpaid rewards from referred shops whose first payment was at least {eligibilityDays} days ago. You can request a payout when your balance is at least ${minPayoutUsd} USD.
        </s-paragraph>
        <div style={{ marginTop: "12px", padding: "16px", background: "var(--p-color-bg-surface-secondary, #f6f6f7)", borderRadius: "8px", maxWidth: "320px" }}>
          <s-text type="strong">Eligible balance: ${eligibleBalance.toFixed(2)} USD</s-text>
          {canRequestPayout ? (
            <div style={{ marginTop: "12px" }}>
              <Form method="post">
                <input type="hidden" name="intent" value="request_payout" />
                <s-button type="submit" variant="primary">Request payout</s-button>
              </Form>
            </div>
          ) : (
            <div style={{ marginTop: "8px" }}>
              <s-paragraph color="subdued">
                {eligibleBalance < minPayoutUsd && eligibleBalance > 0
                  ? `Minimum payout is $${minPayoutUsd}. Keep referring to reach the threshold.`
                  : eligibleBalance > 0
                    ? "Rewards become eligible about 30 days after each referred shop's first payment."
                    : "Refer merchants and earn rewards when they subscribe."}
              </s-paragraph>
            </div>
          )}
        </div>
        {actionData && "error" in actionData && (
          <div role="alert" style={{ marginTop: "12px", padding: "12px", background: "var(--p-color-bg-fill-critical-secondary)", borderRadius: "8px", color: "var(--p-color-text-critical)" }}>
            <s-text>{actionData.error}</s-text>
          </div>
        )}
        {actionData && "success" in actionData && (
          <div style={{ marginTop: "12px", padding: "12px", background: "var(--p-color-bg-fill-success-secondary)", borderRadius: "8px", color: "var(--p-color-text-success)" }}>
            <s-text type="strong">Payout requested.</s-text> We'll process your ${(actionData as { amount: number }).amount.toFixed(2)} USD payout via PayPal or Stripe. You'll be notified when it's sent.
          </div>
        )}
      </s-section>

      <s-section heading="Your referrals">
        <s-paragraph color="subdued">
          Shops that installed the app via your link. Reward is set when they subscribe; it becomes eligible for payout about {eligibilityDays} days after their first payment.
        </s-paragraph>
        {referrals.length === 0 ? (
          <div style={{ marginTop: "12px" }}>
            <s-paragraph color="subdued">No referrals yet. Share your link to get started.</s-paragraph>
          </div>
        ) : (
          <div style={{ marginTop: "12px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--p-color-border-secondary)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Referred shop</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Status</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Reward (USD)</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Eligible from</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--p-color-border-secondary)" }}>
                    <td style={{ padding: "10px 12px" }}>{r.referredShop}</td>
                    <td style={{ padding: "10px 12px" }}>{statusLabel(r)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {r.referrerRewardAmount != null ? `$${r.referrerRewardAmount.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{formatDate(r.referrerRewardEligibleAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}
