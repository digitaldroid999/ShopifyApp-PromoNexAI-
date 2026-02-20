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

const SHORTS_API = "/app/api/shorts";

export default function ProductDetail() {
  const { product, isSample } = useLoaderData<typeof loader>();
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [shortId, setShortId] = useState<string | null>(null);
  const [shortUserId, setShortUserId] = useState<string | null>(null);
  const [scene1Id, setScene1Id] = useState<string | null>(null);
  const [scene2Id, setScene2Id] = useState<string | null>(null);
  const [scene3Id, setScene3Id] = useState<string | null>(null);
  const [productVideoUrl, setProductVideoUrl] = useState<string | null>(null);

  const handleGenerateVideoClick = async () => {
    try {
      const res = await fetch(SHORTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: product.title ?? "Promo video", productId: product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.shortId) setShortId(data.shortId);
      if (data.userId != null) setShortUserId(data.userId);
      if (data.scene1Id != null) setScene1Id(data.scene1Id);
      if (data.scene2Id != null) setScene2Id(data.scene2Id);
      if (data.scene3Id != null) setScene3Id(data.scene3Id);
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
            {productVideoUrl ? (
              <s-stack direction="block" gap="base">
                <s-text type="strong">Promo video</s-text>
                <video
                  src={productVideoUrl}
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
          shortId={shortId}
          shortUserId={shortUserId}
          scene1Id={scene1Id}
          scene2Id={scene2Id}
          scene3Id={scene3Id}
          productImages={productImagesForWorkflow}
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
