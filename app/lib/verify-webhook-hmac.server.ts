/**
 * HMAC-SHA256 verification for Shopify webhooks.
 * Use when the request body must be verified manually (e.g. body consumed before authenticate.webhook).
 * Compute HMAC on the exact raw body; return 401 if verification fails.
 */

import crypto from "node:crypto";

export function verifyShopifyWebhookHmac(
  rawBody: string | Buffer,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, typeof rawBody === "string" ? "utf8" : undefined)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(hmacHeader, "utf8")
    );
  } catch {
    return false;
  }
}
