import type { LoaderFunctionArgs } from "react-router";
import { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE_SECONDS } from "../lib/referral.server";

/**
 * Public invite route: ?ref=referrer-shop.myshopify.com
 * Sets referral cookie and redirects to Shopify App Store so the user can install the app.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref")?.trim();

  const appStoreUrl =
    process.env.SHOPIFY_APP_STORE_URL ||
    (process.env.SHOPIFY_APP_HANDLE
      ? `https://apps.shopify.com/${process.env.SHOPIFY_APP_HANDLE}`
      : null) ||
    process.env.SHOPIFY_APP_URL ||
    "https://apps.shopify.com";

  const cookieValue = ref
    ? `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(ref)}; Path=/; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; HttpOnly`
    : "";

  const headers = new Headers();
  headers.set("Location", appStoreUrl);
  if (cookieValue) headers.append("Set-Cookie", cookieValue);

  return new Response(null, { status: 302, headers });
};
