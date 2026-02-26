import { useState, useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getLegalStatus } from "../lib/legal.server";
import { LegalModal } from "../components/LegalModal";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const legalStatus = await getLegalStatus(session.shop);
  const needsLegalAgreement = !legalStatus.agreed;
  const isUpdatedTerms = legalStatus.isUpdatedTerms;

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    needsLegalAgreement,
    isUpdatedTerms,
  };
};

export default function App() {
  const { apiKey, needsLegalAgreement, isUpdatedTerms } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [showLegalModal, setShowLegalModal] = useState(false);

  useEffect(() => {
    setShowLegalModal(needsLegalAgreement);
  }, [needsLegalAgreement]);

  const handleLegalAgree = () => {
    setShowLegalModal(false);
    revalidator.revalidate();
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/additional">Resources</s-link>
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
