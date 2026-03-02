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

function getProductPrice(product: {
  priceRangeV2?: { minVariantPrice?: { amount?: string; currencyCode?: string } } | null;
}): string {
  const min = product.priceRangeV2?.minVariantPrice;
  if (!min?.amount) return "$0.00";
  const amount = parseFloat(min.amount);
  if (!Number.isFinite(amount)) return "$0.00";
  const code = min.currencyCode ?? "USD";
  if (code === "USD") return `$${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${code}`;
}

function getProductRating(product: {
  metafield?: { value?: string } | null;
}): number {
  const raw = product.metafield?.value;
  if (raw == null || raw === "") return 0;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
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
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      metafield(namespace: "reviews", key: "rating") {
        value
      }
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
        priceRangeV2: { minVariantPrice: { amount: "0", currencyCode: "USD" } },
        metafield: null,
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

const SHORTS_RESET_API = "/app/api/shorts/reset";

export default function ProductDetail() {
  const { product, isSample } = useLoaderData<typeof loader>();
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [openAsEdit, setOpenAsEdit] = useState(false);
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
    setOpenAsEdit(false);
    setWorkflowOpen(true);
  };

  const handleEditVideoClick = () => {
    setOpenAsEdit(true);
    setWorkflowOpen(true);
  };

  const handleCreateNewVideoClick = async () => {
    const shortId = shortsFetcher.data?.shortId?.trim();
    if (shortId) {
      try {
        await fetch(SHORTS_RESET_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortId }),
        });
      } catch {
        // continue to open modal
      }
      shortsFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(product.id)}`);
    }
    setOpenAsEdit(false);
    setWorkflowOpen(true);
  };

  const images = product.images?.edges?.map((e: { node: { id: string; url: string; altText: string | null } }) => e.node) ?? [];
  const productImagesForWorkflow = images.map((img: { id: string; url: string; altText: string | null }, i: number) => ({
    id: img.id,
    src: img.url,
    label: img.altText ?? `Image ${i + 1}`,
  }));

  const price = getProductPrice(product);
  const descriptionSnippet = getProductDescription(product);
  const firstImage = images[0];

  return (
    <>
      <s-page heading={product.title}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
            gap: "24px",
            alignItems: "start",
            marginTop: "16px",
          }}
        >
          <div>
            <s-section heading="Media">
              {images.length > 0 ? (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "480px",
                      aspectRatio: "1",
                      borderRadius: "12px",
                      overflow: "hidden",
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                      marginBottom: "12px",
                    }}
                  >
                    <img
                      src={firstImage.url}
                      alt={firstImage.altText ?? product.title ?? ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                  {images.length > 1 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {images.slice(0, 6).map((img: { id: string; url: string; altText: string | null }) => (
                        <img
                          key={img.id}
                          src={img.url}
                          alt={img.altText ?? ""}
                          style={{
                            width: "72px",
                            height: "72px",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                    borderRadius: "12px",
                    border: "1px dashed var(--p-color-border-secondary, #e1e3e5)",
                    color: "var(--p-color-text-subdued, #6d7175)",
                    fontSize: "14px",
                  }}
                >
                  No product images
                </div>
              )}
            </s-section>
            <div style={{ marginTop: "24px" }}>
              <s-section heading="Promo video">
              {finalVideoUrl ? (
                <div>
                  <video
                    src={finalVideoUrl}
                    controls
                    style={{
                      width: "100%",
                      maxWidth: "480px",
                      borderRadius: "12px",
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: "#000",
                    }}
                  />
                  <div style={{ marginTop: "8px" }}>
                    <s-paragraph color="subdued">Your promo video is ready. Edit it or create a new one to replace it.</s-paragraph>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "32px 24px",
                    textAlign: "center",
                    background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                    borderRadius: "12px",
                    border: "1px dashed var(--p-color-border-secondary, #e1e3e5)",
                  }}
                >
                  <s-text type="strong">No promo video yet</s-text>
                  <div style={{ marginTop: "8px" }}>
                    <s-paragraph color="subdued">Create a short promo video for this product.</s-paragraph>
                  </div>
                </div>
              )}
              </s-section>
            </div>
          </div>
          <div>
            <div
              style={{
                padding: "20px",
                background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                borderRadius: "12px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              }}
            >
              <s-stack direction="block" gap="base">
                <div>
                  <s-text color="subdued">Price</s-text>
                  <div style={{ fontSize: "18px", fontWeight: 600, marginTop: "4px" }}>{price}</div>
                </div>
                <div>
                  <s-text color="subdued">Handle</s-text>
                  <div style={{ marginTop: "4px" }}>{product.handle}</div>
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background:
                        product.status === "ACTIVE"
                          ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)"
                          : product.status === "DRAFT"
                            ? "var(--p-color-bg-fill-secondary, #e1e3e5)"
                            : "var(--p-color-bg-fill-tertiary, #f0f0f0)",
                      color:
                        product.status === "ACTIVE"
                          ? "var(--p-color-text-success, #008060)"
                          : "var(--p-color-text-subdued, #6d7175)",
                    }}
                  >
                    {product.status}
                  </span>
                </div>
                {descriptionSnippet ? (
                  <div>
                    <s-text color="subdued">Description</s-text>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "14px",
                        lineHeight: 1.4,
                        color: "var(--p-color-text-primary, #202223)",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {descriptionSnippet}
                    </p>
                  </div>
                ) : null}
                <div style={{ marginTop: "8px", paddingTop: "16px", borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)" }}>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {finalVideoUrl ? (
                      <>
                        <s-button variant="primary" onClick={handleEditVideoClick}>
                          Edit video
                        </s-button>
                        <s-button variant="secondary" onClick={handleCreateNewVideoClick}>
                          Create new video
                        </s-button>
                      </>
                    ) : (
                      <s-button variant="primary" onClick={handleGenerateVideoClick}>
                        Generate video
                      </s-button>
                    )}
                  </div>
                  <div style={{ marginTop: "8px" }}>
                    <Link to="/app" style={{ display: "block" }}>
                      <s-button variant="tertiary">Back to products</s-button>
                    </Link>
                  </div>
                </div>
              </s-stack>
            </div>
          </div>
        </div>
      </s-page>

      {workflowOpen && (
        <WorkflowModal
          isSample={isSample}
          productId={product.id}
          productImages={productImagesForWorkflow}
          product={{
            name: product.title ?? "Product",
            description: getProductDescription(product),
            price: getProductPrice(product),
            rating: getProductRating(product),
          }}
          openAsEdit={openAsEdit}
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
