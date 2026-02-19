import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { searchStockImages } from "../services/promonexai.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(30, Math.max(1, parseInt(url.searchParams.get("per_page") ?? "12", 10) || 12));

  if (!query.trim()) {
    return Response.json(
      { success: false, error: "Query parameter is required" },
      { status: 400 }
    );
  }

  const result = await searchStockImages(query.trim(), page, perPage);
  return Response.json(result);
};

export default function ApiStockImagesRoute() {
  return null;
}
