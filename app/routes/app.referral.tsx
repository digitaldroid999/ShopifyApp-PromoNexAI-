import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const origin = new URL(request.url).origin;
  const appUrl = process.env.SHOPIFY_APP_URL?.trim();
  const base = origin || (appUrl?.startsWith("http") ? appUrl : `https://${appUrl}`) || "";
  const referralLink = `${base.replace(/\/$/, "")}/invite?ref=${encodeURIComponent(shop)}`;
  return { shop, referralLink };
};

export default function ReferralPage() {
  const { referralLink } = useLoaderData<typeof loader>();
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

  return (
    <s-page heading="Referral">
      <s-section heading="Your referral link">
        <s-paragraph>
          Share this link with other merchants. When they install the app, we&apos;ll record the
          referral and you&apos;ll earn reward credits.
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
    </s-page>
  );
}
