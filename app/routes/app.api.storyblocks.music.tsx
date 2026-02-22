import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { searchStoryblocksMusic } from "../services/storyblocks.server";

/** GET ?query=...&page=...&per_page=... — search Storyblocks music for bg music step */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(20, Math.max(1, parseInt(url.searchParams.get("per_page") ?? "12", 10) || 12));

  const result = await searchStoryblocksMusic(query.trim() || "corporate upbeat", page, perPage);
  return Response.json(result);
};
