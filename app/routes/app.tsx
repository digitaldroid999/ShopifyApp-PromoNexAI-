import { useState, useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getLegalStatus } from "../lib/legal.server";
import { getCredits } from "../lib/credits.server";
import { attributeReferralIfNeeded } from "../lib/referral.server";
import { LegalModal } from "../components/LegalModal";

const REFERRAL_CLEAR_COOKIE_HEADER = "promonex_ref=; Max-Age=0; Path=/";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const [legalStatus, credits, attributionResult] = await Promise.all([
    getLegalStatus(shop),
    getCredits(shop),
    attributeReferralIfNeeded(shop, request),
  ]);
  const needsLegalAgreement = !legalStatus.agreed;
  const isUpdatedTerms = legalStatus.isUpdatedTerms;

  const data = {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop,
    needsLegalAgreement,
    isUpdatedTerms,
    trialEndsAt: credits.trialEndsAt,
    trialEndingSoon: credits.trialEndingSoon,
    trialEnded: credits.trialEnded,
    hasActiveSubscription: credits.hasActiveSubscription,
  };

  // Clear cookie via redirect so the response stays HTML; use SameSite=None so it clears in iframe
  if (attributionResult.clearReferralCookie) {
    const url = new URL(request.url);
    const location = url.pathname + url.search;
    const clearCookieHeader = `${REFERRAL_CLEAR_COOKIE_HEADER}; SameSite=None; Secure`;
    return new Response(null, {
      status: 302,
      headers: { Location: location, "Set-Cookie": clearCookieHeader },
    });
  }
  return data;
};

/**
 * Skip revalidation when URL is unchanged (e.g. focus in embedded iframe).
 * Stops repeated GET /app/subscription.data and auth logs.
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

export default function App() {
  const {
    apiKey,
    needsLegalAgreement,
    isUpdatedTerms,
    trialEndsAt,
    trialEndingSoon,
    trialEnded,
    hasActiveSubscription,
  } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [showLegalModal, setShowLegalModal] = useState(false);

  useEffect(() => {
    setShowLegalModal(needsLegalAgreement);
  }, [needsLegalAgreement]);

  const handleLegalAgree = () => {
    setShowLegalModal(false);
    revalidator.revalidate();
  };

  const showTrialEndingBanner = trialEndingSoon && !hasActiveSubscription;
  const showTrialEndedBanner = trialEnded && !hasActiveSubscription;
  const trialEndDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";

  return (
    <AppProvider embedded apiKey={apiKey}>
      {showTrialEndingBanner && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--p-color-bg-fill-caution-secondary, #fef3e2)",
            borderBottom: "1px solid var(--p-color-border-caution, #e4a853)",
            fontSize: "14px",
          }}
        >
          <strong>Your free trial ends on {trialEndDate}.</strong>{" "}
          <Link to="/app/subscription" style={{ fontWeight: 600, textDecoration: "underline" }}>
            Choose a plan
          </Link>{" "}
          to keep creating videos.
        </div>
      )}
      {showTrialEndedBanner && (
        <div
          style={{
            padding: "16px",
            background: "var(--p-color-bg-fill-critical-secondary, #fbeae5)",
            borderBottom: "1px solid var(--p-color-border-critical, #d72c0d)",
            fontSize: "14px",
          }}
        >
          <strong>Your trial has ended.</strong> Subscribe now to continue using the app. If you
          don&apos;t, your account access will be restricted. If you reinstall the app later, you
          won&apos;t get a free trial again.{" "}
          <Link
            to="/app/subscription"
            style={{
              display: "inline-block",
              marginTop: "8px",
              padding: "8px 16px",
              background: "var(--p-color-bg-fill-critical, #d72c0d)",
              color: "#fff",
              borderRadius: "8px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Choose a plan
          </Link>
        </div>
      )}
      <s-app-nav>
        <Link to="/app">Dashboard</Link>
        <Link to="/app/videos">My Videos</Link>
        <Link to="/app/additional">Resources</Link>
        <Link to="/app/referral">Referral</Link>
        <Link to="/app/subscription">Subscription</Link>
      </s-app-nav>
      <Outlet />
      <LegalModal
        open={showLegalModal}
        onAgree={handleLegalAgree}
        isUpdatedTerms={isUpdatedTerms}
      />
      <footer
        style={{
          marginTop: "24px",
          padding: "16px",
          borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)",
          fontSize: "13px",
          color: "var(--p-color-text-subdued, #6d7175)",
        }}
      >
        <s-stack direction="inline" gap="base">
          <s-text>PromoNexAI</s-text>
          <span style={{ margin: "0 4px", color: "var(--p-color-text-subdued, #6d7175)" }}>·</span>
          <Link to="/legal/terms">Terms of Service</Link>
          <span style={{ margin: "0 4px", color: "var(--p-color-text-subdued, #6d7175)" }}>·</span>
          <Link to="/legal/privacy">Privacy Policy</Link>
          <span style={{ margin: "0 4px", color: "var(--p-color-text-subdued, #6d7175)" }}>·</span>
          <Link to="/legal/data-processing">Data Processing Agreement</Link>
        </s-stack>
      </footer>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
