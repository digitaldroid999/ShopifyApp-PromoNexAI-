import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Use origin only to avoid getaddrinfo ENOTFOUND when the library uses appUrl as hostname.
// Partner Dashboard redirect URLs must match: e.g. https://app.promonexai.com/shopify/auth/callback
const rawAppUrl =
  (process.env.SHOPIFY_APP_URL || process.env.HOST || "").trim() || "";
const appUrlParsed =
  rawAppUrl && rawAppUrl.startsWith("http")
    ? new URL(rawAppUrl.replace(/\/+$/, ""))
    : null;
const appUrlOrigin = appUrlParsed ? appUrlParsed.origin : "";
const appUrlWithPath = appUrlParsed
  ? appUrlParsed.origin + (appUrlParsed.pathname === "/" ? "" : appUrlParsed.pathname)
  : "";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: appUrlOrigin || appUrlWithPath || rawAppUrl,
  authPathPrefix:
    appUrlParsed && appUrlParsed.pathname !== "/"
      ? appUrlParsed.pathname.replace(/\/+$/, "") + "/auth"
      : "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
