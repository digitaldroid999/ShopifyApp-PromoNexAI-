import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator, useSearchParams } from "react-router";
import { Link } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

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

function toProductIdSegment(productId: string | null): string | null {
  if (!productId?.trim()) return null;
  const id = productId.trim();
  if (id.startsWith("gid://shopify/Product/")) return id.replace("gid://shopify/Product/", "");
  return id;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop?.trim() ?? "";
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const cursor = url.searchParams.get("cursor") ?? null;

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

  let stats = { totalShorts: 0, readyCount: 0, generatingCount: 0, draftCount: 0 };
  let recentShorts: { id: string; title: string; productId: string | null; status: string; finalVideoUrl: string | null; updatedAt: Date; thumbnailUrl: string | null }[] = [];
  let productIdToShortStatus: Record<string, string> = {};

  if (shop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shortDelegate = (prisma as any).short;
    if (shortDelegate) {
      const [totalShorts, readyCount, generatingCount, draftCount, recentList, allShortsForMap] = await Promise.all([
        shortDelegate.count({ where: { userId: shop } }),
        shortDelegate.count({ where: { userId: shop, status: "ready" } }),
        shortDelegate.count({ where: { userId: shop, status: "generating" } }),
        shortDelegate.count({ where: { userId: shop, status: "draft" } }),
        shortDelegate.findMany({
          where: { userId: shop },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            productId: true,
            status: true,
            finalVideoUrl: true,
            updatedAt: true,
            scenes: {
              take: 1,
              orderBy: { sceneNumber: "asc" },
              select: { imageUrl: true, generatedVideoUrl: true },
            },
          },
        }) as Promise<{ id: string; title: string; productId: string | null; status: string; finalVideoUrl: string | null; updatedAt: Date; scenes: { imageUrl: string | null; generatedVideoUrl: string | null }[] }[]>,
        shortDelegate.findMany({
          where: { userId: shop },
          select: { productId: true, status: true },
        }) as Promise<{ productId: string | null; status: string }[]>,
      ]);

      stats = { totalShorts, readyCount, generatingCount, draftCount };
      recentShorts = (recentList ?? []).map((s: { id: string; title: string; productId: string | null; status: string; finalVideoUrl: string | null; updatedAt: Date; scenes: { imageUrl: string | null; generatedVideoUrl: string | null }[] }) => {
        const thumb = s.finalVideoUrl?.trim() || s.scenes?.[0]?.generatedVideoUrl?.trim() || s.scenes?.[0]?.imageUrl?.trim() || null;
        return {
          id: s.id,
          title: s.title,
          productId: s.productId,
          status: s.status,
          finalVideoUrl: s.finalVideoUrl?.trim() || null,
          updatedAt: s.updatedAt,
          thumbnailUrl: thumb,
        };
      });
      for (const row of allShortsForMap ?? []) {
        if (row.productId) {
          const pid = row.productId.trim();
          productIdToShortStatus[pid] = row.status;
          if (!pid.startsWith("gid://")) productIdToShortStatus[`gid://shopify/Product/${pid}`] = row.status;
        }
      }
    }
  }

  return {
    products,
    pageInfo,
    search,
    status,
    stats,
    recentShorts,
    productIdToShortStatus,
  };
};

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation productUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      userErrors { field message }
      product { id title handle status }
    }
  }
`;

const VARIANTS_UPDATE_MUTATION = `#graphql
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      userErrors { field message }
      productVariants { id price title }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "editProduct") {
    const productId = formData.get("productId") as string;
    const title = formData.get("title") as string;
    const handle = formData.get("handle") as string;
    const status = formData.get("status") as string;
    const variantUpdatesJson = formData.get("variantUpdates") as string | null;
    if (!productId) {
      return { editError: "Missing product ID" };
    }
    const productInput: { id: string; title?: string; handle?: string; status?: string } = { id: productId };
    if (title != null && title !== "") productInput.title = title;
    if (handle != null && handle !== "") productInput.handle = handle;
    if (status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(status)) productInput.status = status;

    const updateRes = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
      variables: { product: productInput },
    });
    const updateJson = await updateRes.json();
    const userErrors = updateJson?.data?.productUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return { editError: userErrors.map((e: { message: string }) => e.message).join(", ") };
    }

    let variantResult = null;
    if (variantUpdatesJson) {
      try {
        const variantUpdates = JSON.parse(variantUpdatesJson) as Array<{ id: string; price: string }>;
        if (variantUpdates.length > 0) {
          const variantRes = await admin.graphql(VARIANTS_UPDATE_MUTATION, {
            variables: { productId, variants: variantUpdates },
          });
          const variantJson = await variantRes.json();
          variantResult = variantJson?.data?.productVariantsBulkUpdate;
          const verrors = variantResult?.userErrors ?? [];
          if (verrors.length > 0) {
            return { editError: verrors.map((e: { message: string }) => e.message).join(", ") };
          }
        }
      } catch {
        return { editError: "Invalid variant updates" };
      }
    }
    return {
      editSuccess: true,
      product: updateJson?.data?.productUpdate?.product,
      variantUpdates: variantResult?.productVariants,
    };
  }

  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage?: { url: string; altText: string | null } | null;
  images?: {
    edges: Array<{ node: { url: string; altText: string | null } }>;
  };
  variants: {
    edges: Array<{
      node: { id: string; price: string; title: string };
    }>;
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const loadMoreFetcher = useFetcher<{ products: ProductNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }>();
  const revalidator = useRevalidator();
  const { products: loaderProducts, pageInfo: loaderPageInfo, stats, recentShorts, productIdToShortStatus } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductNode[]>(loaderProducts as ProductNode[]);
  const [pageInfo, setPageInfo] = useState(loaderPageInfo);
  const [editingProduct, setEditingProduct] = useState<ProductNode | null>(null);
  const shopify = useAppBridge();

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";

  useEffect(() => {
    if (!searchParams.get("cursor")) {
      setProducts(loaderProducts as ProductNode[]);
      setPageInfo(loaderPageInfo);
    }
  }, [loaderProducts, loaderPageInfo, searchParams]);

  useEffect(() => {
    if (fetcher.data?.editSuccess) {
      shopify.toast.show("Product updated");
      setEditingProduct(null);
      revalidator.revalidate();
    }
    if (fetcher.data?.editError) {
      shopify.toast.show(fetcher.data.editError as string, { isError: true });
    }
    if (fetcher.data?.product?.id && !fetcher.data?.editSuccess) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (loadMoreFetcher.data?.products?.length) {
      setProducts((prev) => [...prev, ...(loadMoreFetcher.data!.products ?? [])]);
      setPageInfo(loadMoreFetcher.data!.pageInfo ?? pageInfo);
    }
  }, [loadMoreFetcher.data]);

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const isLoadMoreLoading = loadMoreFetcher.state === "loading";

  const applyFilters = (newSearch: string, newStatus: string) => {
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    if (newStatus !== "all") params.set("status", newStatus);
    setSearchParams(params, { replace: true });
  };

  const loadMore = () => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return;
    const params = new URLSearchParams();
    params.set("cursor", pageInfo.endCursor);
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    loadMoreFetcher.load(`/app/products/more?${params.toString()}`);
  };

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="PromoNexAI">
      <s-button slot="primary-action" onClick={generateProduct}>
        Generate a product
      </s-button>

      <div style={{ marginBottom: "16px" }}>
        <s-paragraph color="subdued">
          Create short promo videos for your store products.
        </s-paragraph>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
          }}
        >
          <s-text color="subdued">Products</s-text>
          <div style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>{loaderProducts?.length ?? 0}</div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
          }}
        >
          <s-text color="subdued">Videos created</s-text>
          <div style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>{stats?.readyCount ?? 0}</div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
          }}
        >
          <s-text color="subdued">In progress</s-text>
          <div style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>{stats?.generatingCount ?? 0}</div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
          }}
        >
          <s-text color="subdued">Drafts</s-text>
          <div style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>{stats?.draftCount ?? 0}</div>
        </div>
      </div>

      {stats?.totalShorts === 0 && (
        <div
          style={{
            padding: "24px",
            marginBottom: "24px",
            background: "var(--p-color-bg-surface-primary, #fff)",
            borderRadius: "8px",
            border: "1px solid var(--p-color-border-info, #2c6ecb)",
          }}
        >
          <s-text type="strong">Create your first promo video</s-text>
          <div style={{ marginTop: "8px" }}>
            <s-paragraph color="subdued">
              Choose a product below and click Generate video to get started.
            </s-paragraph>
          </div>
        </div>
      )}

      {recentShorts?.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <s-section heading="Recent videos">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            {recentShorts.map((s) => {
              const segment = toProductIdSegment(s.productId);
              return (
                <Link key={s.id} to={segment ? `/app/products/${segment}` : "/app"} style={{ textDecoration: "none", color: "inherit" }}>
                  <div
                    style={{
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                    }}
                  >
                    <div style={{ aspectRatio: "16/9", background: "var(--p-color-bg-fill-tertiary, #f0f0f0)" }}>
                      {s.thumbnailUrl ? (
                        s.thumbnailUrl.match(/\.(mp4|webm|mov)$/i) ? (
                          <video src={s.thumbnailUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                        ) : (
                          <img src={s.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)" }}>No preview</div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <s-text type="strong">{s.title}</s-text>
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "4px",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 500,
                          background: s.status === "ready" ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)" : s.status === "generating" ? "var(--p-color-bg-fill-caution-secondary, #fcf1e0)" : "var(--p-color-bg-fill-secondary, #e1e3e5)",
                          color: s.status === "ready" ? "var(--p-color-text-success, #008060)" : s.status === "generating" ? "var(--p-color-text-caution, #b98900)" : "var(--p-color-text-subdued, #6d7175)",
                        }}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          </s-section>
        </div>
      )}

      <s-section heading="Your products">
        <div style={{ marginTop: "8px", marginBottom: "12px" }}>
          <s-paragraph>
            Select a product to create a promo video.
          </s-paragraph>
        </div>
        <s-stack direction="block" gap="base">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <s-text>Search:</s-text>
              <input
                type="search"
                placeholder="By title..."
                value={search}
                onChange={(e) => setSearchParams((p) => {
                  const next = new URLSearchParams(p);
                  if (e.target.value) next.set("search", e.target.value);
                  else next.delete("search");
                  return next;
                }, { replace: true })}
                onKeyDown={(e) => e.key === "Enter" && applyFilters((e.target as HTMLInputElement).value, status)}
                style={{
                  padding: "8px 12px",
                  minWidth: "180px",
                  border: "1px solid var(--p-color-border, #8c9196)",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <s-text>Status:</s-text>
              <select
                value={status}
                onChange={(e) => applyFilters(search, e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--p-color-border, #8c9196)",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              >
                <option value="all">All</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <s-button onClick={() => applyFilters(search, status)}>Apply</s-button>
          </div>
          {editingProduct ? (
            <div style={{ borderLeft: "4px solid var(--p-color-border-info, #2c6ecb)", paddingLeft: "16px" }}>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                <s-text type="strong">Edit product</s-text>
                <fetcher.Form
                method="post"
                style={{ marginTop: "12px" }}
                onSubmit={(e) => {
                  const form = e.currentTarget;
                  const variantUpdates = editingProduct.variants?.edges?.map(({ node: v }) => ({
                    id: v.id,
                    price: (form.querySelector(`input[name="price_${v.id}"]`) as HTMLInputElement)?.value ?? v.price,
                  })) ?? [];
                  const input = document.createElement("input");
                  input.type = "hidden";
                  input.name = "variantUpdates";
                  input.value = JSON.stringify(variantUpdates);
                  form.appendChild(input);
                }}
              >
                <input type="hidden" name="intent" value="editProduct" />
                <input type="hidden" name="productId" value={editingProduct.id} />
                <s-stack direction="block" gap="base">
                  <label>
                    <s-text>Title</s-text>
                    <input type="text" name="title" defaultValue={editingProduct.title} style={{ display: "block", width: "100%", padding: "6px", marginTop: "4px" }} />
                  </label>
                  <label>
                    <s-text>Handle</s-text>
                    <input type="text" name="handle" defaultValue={editingProduct.handle} style={{ display: "block", width: "100%", padding: "6px", marginTop: "4px" }} />
                  </label>
                  <label>
                    <s-text>Status</s-text>
                    <select name="status" defaultValue={editingProduct.status} style={{ display: "block", padding: "6px", marginTop: "4px" }}>
                      <option value="ACTIVE">Active</option>
                      <option value="DRAFT">Draft</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </label>
                  {editingProduct.variants?.edges?.length ? (
                    <fieldset>
                      <s-text>Variant prices</s-text>
                      {editingProduct.variants.edges.map(({ node: v }) => (
                        <label key={v.id} style={{ display: "block", marginTop: "4px" }}>
                          <s-text color="subdued">{v.title}:</s-text>
                          <input type="text" name={`price_${v.id}`} defaultValue={v.price} placeholder="Price" style={{ marginLeft: "8px", padding: "4px", width: "100px" }} />
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  <s-stack direction="inline" gap="base">
                    <s-button type="submit" variant="primary" disabled={fetcher.state === "submitting"}>
                      {fetcher.state === "submitting" ? "Saving…" : "Save"}
                    </s-button>
                    <s-button type="button" variant="tertiary" onClick={() => setEditingProduct(null)}>Cancel</s-button>
                  </s-stack>
                </s-stack>
              </fetcher.Form>
              </s-box>
            </div>
          ) : null}
        {products.length === 0 && !loadMoreFetcher.state ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              borderRadius: "8px",
              border: "1px dashed var(--p-color-border-secondary, #e1e3e5)",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <s-paragraph color="subdued">No products match. Use “Generate a product” to create one.</s-paragraph>
            </div>
            <s-button onClick={generateProduct} variant="primary" {...(isLoading ? { loading: true } : {})}>
              Generate a product
            </s-button>
          </div>
          ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {products.map((product) => {
              const productIdSegment = product.id === "sample" ? "sample" : product.id.split("/").pop();
              const imageUrl =
                product.featuredImage?.url ??
                product.images?.edges?.[0]?.node?.url ??
                null;
              const imageAlt = product.featuredImage?.altText ?? product.images?.edges?.[0]?.node?.altText ?? product.title;
              return (
                <s-box
                  key={product.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div
                      style={{
                        width: "96px",
                        height: "96px",
                        flexShrink: 0,
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "var(--p-color-bg-surface-secondary, #e1e3e5)",
                      }}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={imageAlt ?? ""}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            color: "var(--p-color-text-subdued, #6d7175)",
                          }}
                        >
                          No image
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <s-stack direction="block" gap="base">
                      <s-text type="strong">{product.title}</s-text>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
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
                                : product.status === "DRAFT"
                                  ? "var(--p-color-text-subdued, #6d7175)"
                                  : "var(--p-color-text-subdued, #6d7175)",
                          }}
                        >
                          {product.status}
                        </span>
                        <s-text color="subdued">Handle: {product.handle}</s-text>
                        {productIdToShortStatus?.[product.id] ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 500,
                              background:
                                productIdToShortStatus[product.id] === "ready"
                                  ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)"
                                  : productIdToShortStatus[product.id] === "generating"
                                    ? "var(--p-color-bg-fill-caution-secondary, #fcf1e0)"
                                    : "var(--p-color-bg-fill-secondary, #e1e3e5)",
                              color:
                                productIdToShortStatus[product.id] === "ready"
                                  ? "var(--p-color-text-success, #008060)"
                                  : productIdToShortStatus[product.id] === "generating"
                                    ? "var(--p-color-text-caution, #b98900)"
                                    : "var(--p-color-text-subdued, #6d7175)",
                            }}
                          >
                            Video {productIdToShortStatus[product.id] === "ready" ? "ready" : productIdToShortStatus[product.id] === "generating" ? "in progress" : "draft"}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 500,
                              background: "var(--p-color-bg-fill-tertiary, #f0f0f0)",
                              color: "var(--p-color-text-subdued, #6d7175)",
                            }}
                          >
                            No video
                          </span>
                        )}
                      </div>
                      {product.variants?.edges?.length > 0 && (
                        <s-text color="subdued">
                          Variants: {product.variants.edges.map((e) => `${e.node.title} – ${e.node.price}`).join(", ")}
                        </s-text>
                      )}
                      <div style={{ marginTop: "12px" }}>
                        <s-stack direction="inline" gap="base">
                          <Link to={`/app/products/${productIdSegment}`}>
                            <s-button variant="primary">Generate video</s-button>
                          </Link>
                          {product.id !== "sample" && (
                            <s-button
                              variant="tertiary"
                              onClick={() => shopify.intents.invoke?.("edit:shopify/Product", { value: product.id })}
                            >
                              Edit in Shopify
                            </s-button>
                          )}
                        </s-stack>
                      </div>
                    </s-stack>
                  </div>
                  </div>
                </s-box>
              );
            })}
          </div>
        )}
          {pageInfo.hasNextPage && pageInfo.endCursor ? (
            <div style={{ marginTop: "16px" }}>
              <s-button onClick={loadMore} {...(isLoadMoreLoading ? { loading: true } : {})}>
              Load more
            </s-button>
            </div>
          ) : null}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
