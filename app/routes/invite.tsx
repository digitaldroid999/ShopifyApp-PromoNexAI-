import type { LoaderFunctionArgs } from "react-router";
import { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE_SECONDS } from "../lib/referral.server";

/**
 * Public invite route: ?ref=referrer-shop.myshopify.com
 * Sets referral cookie and redirects to Shopify App Store (or REFERRAL_INVITE_REDIRECT_URL for testing).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref")?.trim();

  // For testing without App Store: set REFERRAL_INVITE_REDIRECT_URL to your app URL (e.g. https://sa.promonexai.com)
  const redirectUrl =
    process.env.REFERRAL_INVITE_REDIRECT_URL?.trim() ||
    process.env.SHOPIFY_APP_STORE_URL ||
    (process.env.SHOPIFY_APP_HANDLE
      ? `https://apps.shopify.com/${process.env.SHOPIFY_APP_HANDLE}`
      : null) ||
    process.env.SHOPIFY_APP_URL ||
    "https://apps.shopify.com";

  // SameSite=None; Secure so the cookie is sent when the app loads in the Shopify Admin iframe (cross-site)
  const cookieValue = ref
    ? `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(ref)}; Path=/; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; SameSite=None; Secure; HttpOnly`
    : "";

  const headers = new Headers();
  headers.set("Location", redirectUrl);
  if (cookieValue) headers.append("Set-Cookie", cookieValue);

  return new Response(null, { status: 302, headers });
};
