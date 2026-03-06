import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { searchStoryblocksMusic } from "../services/storyblocks.server";
import { getCredits } from "../lib/credits.server";

/** GET ?query=...&page=...&per_page=... — search Storyblocks music for bg music step. Requires Premium Music add-on. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop ?? "";
  if (!shop) {
    return Response.json({ success: false, tracks: [], total: 0, error: "Premium Music required" }, { status: 403 });
  }
  const credits = await getCredits(shop);
  if (!credits.isPremiumMusic) {
    return Response.json({ success: false, tracks: [], total: 0, error: "Premium Music add-on required. Subscribe in Subscription to unlock Storyblocks music." }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(20, Math.max(1, parseInt(url.searchParams.get("per_page") ?? "12", 10) || 12));

  const result = await searchStoryblocksMusic(query.trim() || "corporate upbeat", page, perPage);
  return Response.json(result);
};
