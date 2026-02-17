import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const PRODUCTS_QUERY = `#graphql
  query getProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true, query: $query, after: $after) {
      edges {
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                price
                title
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function buildProductsQuery(search: string | null, status: string | null): string | undefined {
  const parts: string[] = [];
  if (status && status !== "all") {
    parts.push(`status:${status}`);
  }
  if (search?.trim()) {
    parts.push(search.trim());
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const cursor = url.searchParams.get("cursor");
  if (!cursor) {
    return Response.json({ products: [], pageInfo: { hasNextPage: false, endCursor: null } });
  }

  const queryString = buildProductsQuery(search || null, status || null);

  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: {
      first: 25,
      query: queryString || null,
      after: cursor,
    },
  });
  const json = await response.json();
  const connection = json?.data?.products;
  const products = connection?.edges?.map((e: { node: unknown }) => e.node) ?? [];
  const pageInfo = connection?.pageInfo ?? { hasNextPage: false, endCursor: null };

  return Response.json({ products, pageInfo });
};
