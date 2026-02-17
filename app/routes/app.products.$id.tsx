import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { WorkflowModal } from "../components/WorkflowModal";

const MOCKUP_BASE = "/mockup";

const PRODUCT_QUERY = `#graphql
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      images(first: 10) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
    }
  }
`;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const id = params.id;
  if (id === "sample") {
    return {
      product: {
        id: "sample",
        title: "Sample product (video mockup)",
        handle: "sample-product-mockup",
        status: "ACTIVE",
        images: {
          edges: [
            { node: { id: "img1", url: `${MOCKUP_BASE}/scene1-original.jpg`, altText: "Scene 1" } },
            { node: { id: "img2", url: `${MOCKUP_BASE}/scene2-original.jpg`, altText: "Scene 2" } },
            { node: { id: "img3", url: `${MOCKUP_BASE}/scene3-original.jpg`, altText: "Scene 3" } },
          ],
        },
      },
      isSample: true,
    };
  }

  const { admin } = await authenticate.admin(request);
  const gid = id?.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
  const response = await admin.graphql(PRODUCT_QUERY, { variables: { id: gid } });
  const json = await response.json();
  const product = json?.data?.product;
  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }
  return { product, isSample: false };
};

export default function ProductDetail() {
  const { product, isSample } = useLoaderData<typeof loader>();
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const images = product.images?.edges?.map((e: { node: { id: string; url: string; altText: string | null } }) => e.node) ?? [];

  return (
    <>
      <s-page heading={product.title}>
        <s-section heading="Product detail">
          <s-stack direction="block" gap="base">
            <s-paragraph tone="subdued">
              Handle: {product.handle} · Status: {product.status}
            </s-paragraph>
            {images.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {images.map((img: { id: string; url: string; altText: string | null }) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.altText ?? ""}
                    style={{
                      width: "160px",
                      height: "160px",
                      objectFit: "cover",
                      borderRadius: "12px",
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    }}
                  />
                ))}
              </div>
            ) : null}
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={() => setWorkflowOpen(true)}>
                Generate video
              </s-button>
              <Link to="/app">
                <s-button variant="tertiary">← Back to products</s-button>
              </Link>
            </s-stack>
          </s-stack>
        </s-section>
      </s-page>

      {workflowOpen && (
        <WorkflowModal
          isSample={isSample}
          onClose={() => setWorkflowOpen(false)}
        />
      )}
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
