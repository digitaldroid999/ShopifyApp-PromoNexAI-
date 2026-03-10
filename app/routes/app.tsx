import { useState, useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getLegalStatus } from "../lib/legal.server";
import { getCredits } from "../lib/credits.server";
import { LegalModal } from "../components/LegalModal";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const [legalStatus, credits] = await Promise.all([
    getLegalStatus(shop),
    getCredits(shop),
  ]);
  const needsLegalAgreement = !legalStatus.agreed;
  const isUpdatedTerms = legalStatus.isUpdatedTerms;

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop,
    needsLegalAgreement,
    isUpdatedTerms,
    trialEndsAt: credits.trialEndsAt,
    trialEndingSoon: credits.trialEndingSoon,
    trialEnded: credits.trialEnded,
    hasActiveSubscription: credits.hasActiveSubscription,
  };
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
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/videos">My Videos</s-link>
        <s-link href="/app/additional">Resources</s-link>
        <s-link href="/app/subscription">Subscription</s-link>
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
          <s-link href="/legal/terms">Terms of Service</s-link>
          <span style={{ margin: "0 4px", color: "var(--p-color-text-subdued, #6d7175)" }}>·</span>
          <s-link href="/legal/privacy">Privacy Policy</s-link>
          <span style={{ margin: "0 4px", color: "var(--p-color-text-subdued, #6d7175)" }}>·</span>
          <s-link href="/legal/data-processing">Data Processing Agreement</s-link>
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
