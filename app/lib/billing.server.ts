/**
 * Shopify app billing: recurring subscription helpers.
 * Uses GraphQL Admin API (appSubscriptionCreate, currentAppInstallation).
 */

import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const CURRENT_INSTALLATION_QUERY = `#graphql
  query GetCurrentAppInstallation {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        lineItems {
          id
          plan {
            ... on AppRecurringPricing {
              interval
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export type ActiveSubscription = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  currentPeriodEnd: string | null;
  lineItems: Array<{
    id: string;
    plan: {
      interval: string;
      price: { amount: string; currencyCode: string };
    };
  }>;
};

export type BillingStatus = {
  hasActiveSubscription: boolean;
  activeSubscriptions: ActiveSubscription[];
};

export async function getBillingStatus(admin: AdminApiContext["admin"]): Promise<BillingStatus> {
  const response = await admin.graphql(CURRENT_INSTALLATION_QUERY);
  const json = (await response.json()) as {
    data?: {
      currentAppInstallation?: {
        activeSubscriptions?: Array<{
          id: string;
          name: string;
          status: string;
          createdAt: string;
          currentPeriodEnd: string | null;
          lineItems?: Array<{
            id: string;
            plan: {
              interval: string;
              price: { amount: string; currencyCode: string };
            };
          }>;
        }>;
      };
    };
  };

  const raw = json?.data?.currentAppInstallation?.activeSubscriptions ?? [];
  const activeSubscriptions: ActiveSubscription[] = raw.map((sub) => ({
    id: sub.id,
    name: sub.name,
    status: sub.status,
    createdAt: sub.createdAt,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    lineItems: (sub.lineItems ?? []).map((li) => ({
      id: li.id,
      plan: li.plan,
    })),
  }));

  const hasActiveSubscription = activeSubscriptions.some(
    (s) => s.status === "ACTIVE" || s.status === "PENDING" || s.status === "FROZEN"
  );

  return { hasActiveSubscription, activeSubscriptions };
}

const APP_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
    ) {
      appSubscription { id }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

export type CreateSubscriptionParams = {
  name: string;
  returnUrl: string;
  lineItems: Array<{
    plan: {
      appRecurringPricingDetails: {
        interval: "EVERY_30_DAYS" | "ANNUAL";
        price: { amount: string; currencyCode: string };
      };
    };
  }>;
  trialDays?: number;
  test?: boolean;
};

export type CreateSubscriptionResult = {
  success: boolean;
  confirmationUrl?: string;
  userErrors?: Array<{ field: string[]; message: string }>;
};

export async function createAppSubscription(
  admin: AdminApiContext["admin"],
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const response = await admin.graphql(APP_SUBSCRIPTION_CREATE_MUTATION, {
    variables: {
      name: params.name,
      returnUrl: params.returnUrl,
      lineItems: params.lineItems,
      trialDays: params.trialDays ?? null,
      test: params.test ?? false,
    },
  });

  const json = (await response.json()) as {
    data?: {
      appSubscriptionCreate?: {
        appSubscription?: { id: string };
        confirmationUrl?: string;
        userErrors?: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    return {
      success: false,
      userErrors: json.errors.map((e) => ({ field: [], message: e.message })),
    };
  }

  const payload = json?.data?.appSubscriptionCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { success: false, userErrors };
  }

  const confirmationUrl = payload?.confirmationUrl;
  if (!confirmationUrl) {
    return { success: false, userErrors: [{ field: [], message: "No confirmation URL returned" }] };
  }

  return { success: true, confirmationUrl };
}

/** Plan shape for the subscription page (highlighted is optional). */
export type SubscriptionPlanItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  currencyCode: string;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  features: readonly string[];
  highlighted?: boolean;
};

/** Predefined plans for the subscription page. */
export const SUBSCRIPTION_PLANS: SubscriptionPlanItem[] = [
  {
    id: "basic",
    name: "PromoNexAI Basic",
    description: "Up to 5 promo videos per month",
    price: "9.99",
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    features: ["5 videos/month", "HD export", "Music library", "Email support"],
  },
  {
    id: "pro",
    name: "PromoNexAI Pro",
    description: "Up to 20 promo videos per month",
    price: "29.99",
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    features: ["20 videos/month", "HD export", "Music library", "Priority support", "Custom branding"],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "PromoNexAI Enterprise",
    description: "Unlimited promo videos",
    price: "99.99",
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    features: ["Unlimited videos", "HD export", "Music library", "Dedicated support", "Custom branding", "API access"],
  },
];
