import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { WorkflowModal } from "../components/WorkflowModal";

const MOCKUP_BASE = "/mockup";

function getProductDescription(product: { description?: string | null; descriptionHtml?: string | null }): string | undefined {
  const plain = product.description?.trim();
  if (plain) return plain;
  const html = product.descriptionHtml?.trim();
  if (!html) return undefined;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

const PRODUCT_QUERY = `#graphql
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      description
      descriptionHtml
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
        description: "Sample product description for mockup.",
        descriptionHtml: "<p>Sample product description for mockup.</p>",
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

const SHORTS_API = "/app/api/shorts";

export default function ProductDetail() {
  const { product, isSample } = useLoaderData<typeof loader>();
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [productVideoUrl, setProductVideoUrl] = useState<string | null>(null);
  const shortsFetcher = useFetcher<{ finalVideoUrl?: string | null; shortId?: string | null }>();

  useEffect(() => {
    if (!isSample && product?.id) {
      shortsFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(product.id)}`);
    }
  }, [product?.id, isSample]);

  const finalVideoUrl = productVideoUrl ?? (shortsFetcher.data?.finalVideoUrl?.trim() || null);

  const handleGenerateVideoClick = async () => {
    try {
      await fetch(SHORTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: product.title ?? "Promo video", productId: product.id }),
      });
    } catch {
      // continue to open modal
    }
    setWorkflowOpen(true);
  };

  const images = product.images?.edges?.map((e: { node: { id: string; url: string; altText: string | null } }) => e.node) ?? [];
  const productImagesForWorkflow = images.map((img: { id: string; url: string; altText: string | null }, i: number) => ({
    id: img.id,
    src: img.url,
    label: img.altText ?? `Image ${i + 1}`,
  }));

  return (
    <>
      <s-page heading={product.title}>
        <s-section heading="Product detail">
          <s-stack direction="block" gap="base">
            <s-paragraph color="subdued">
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
            {finalVideoUrl ? (
              <s-stack direction="block" gap="base">
                <s-text type="strong">Promo video</s-text>
                <video
                  src={finalVideoUrl}
                  controls
                  style={{
                    maxWidth: "100%",
                    width: "400px",
                    maxHeight: "280px",
                    borderRadius: "12px",
                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  }}
                />
              </s-stack>
            ) : null}
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={handleGenerateVideoClick}>
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
          productId={product.id}
          productImages={productImagesForWorkflow}
          product={{
            name: product.title ?? "Product",
            description: getProductDescription(product),
          }}
          onClose={() => setWorkflowOpen(false)}
          onDone={(videoUrl) => setProductVideoUrl(videoUrl)}
        />
      )}
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
