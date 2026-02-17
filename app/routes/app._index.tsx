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

const PRODUCTS_QUERY = `#graphql
  query getProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true, query: $query, after: $after) {
      edges {
        node {
          id
          title
          handle
          status
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

  return { products, pageInfo, search, status };
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
  variants: {
    edges: Array<{
      node: { id: string; price: string; title: string };
    }>;
  };
};

const SAMPLE_PRODUCT: ProductNode = {
  id: "sample",
  title: "Sample product (video mockup)",
  handle: "sample-product-mockup",
  status: "ACTIVE",
  variants: { edges: [] },
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const loadMoreFetcher = useFetcher<{ products: ProductNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }>();
  const revalidator = useRevalidator();
  const { products: loaderProducts, pageInfo: loaderPageInfo } = useLoaderData<typeof loader>();
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

      <s-section heading="Products in your store">
        <s-paragraph>
          Search, filter by status, load more, or edit products below.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
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
                style={{ padding: "6px 10px", minWidth: "180px" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <s-text>Status:</s-text>
              <select value={status} onChange={(e) => applyFilters(search, e.target.value)} style={{ padding: "6px 10px" }}>
                <option value="all">All</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <s-button onClick={() => applyFilters(search, status)}>Apply</s-button>
          </s-stack>
          {editingProduct ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-text fontWeight="bold">Edit product</s-text>
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
                          <s-text tone="subdued">{v.title}:</s-text>
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
          ) : null}
        {products.length === 0 && !loadMoreFetcher.state ? (
          <s-paragraph tone="subdued">No products match. Use “Generate a product” to create one.</s-paragraph>
          ) : (
          <s-stack direction="block" gap="base">
            {[SAMPLE_PRODUCT, ...products].map((product) => {
              const productIdSegment = product.id === "sample" ? "sample" : product.id.split("/").pop();
              return (
                <s-box
                  key={product.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="tight">
                    <s-text fontWeight="bold">{product.title}</s-text>
                    <s-text tone="subdued">Handle: {product.handle} · Status: {product.status}</s-text>
                    {product.variants?.edges?.length > 0 && (
                      <s-text tone="subdued">
                        Variants: {product.variants.edges.map((e) => `${e.node.title} – ${e.node.price}`).join(", ")}
                      </s-text>
                    )}
                    <s-stack direction="inline" gap="tight">
                      <Link to={`/app/products/${productIdSegment}`}>
                        <s-button variant="tertiary">Edit</s-button>
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
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        )}
          {pageInfo.hasNextPage && pageInfo.endCursor ? (
            <s-button onClick={loadMore} {...(isLoadMoreLoading ? { loading: true } : {})}>
              Load more
            </s-button>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Congrats on creating a new Shopify app 🎉">
        <s-paragraph>
          This embedded app template uses{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>{" "}
          interface examples like an{" "}
          <s-link href="/app/additional">additional page in the app nav</s-link>
          , as well as an{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            Admin GraphQL
          </s-link>{" "}
          mutation demo, to provide a starting point for app development.
        </s-paragraph>
      </s-section>
      <s-section heading="Get started with products">
        <s-paragraph>
          Generate a product with GraphQL and get the JSON output for that
          product. Learn more about the{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
            target="_blank"
          >
            productCreate
          </s-link>{" "}
          mutation in our API references.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={generateProduct}
            {...(isLoading ? { loading: true } : {})}
          >
            Generate a product
          </s-button>
          {fetcher.data?.product && (
            <s-button
              onClick={() => {
                shopify.intents.invoke?.("edit:shopify/Product", {
                  value: fetcher.data?.product?.id,
                });
              }}
              target="_blank"
              variant="tertiary"
            >
              Edit product
            </s-button>
          )}
        </s-stack>
        {fetcher.data?.product && (
          <s-section heading="productCreate mutation">
            <s-stack direction="block" gap="base">
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre style={{ margin: 0 }}>
                  <code>{JSON.stringify(fetcher.data.product, null, 2)}</code>
                </pre>
              </s-box>

              <s-heading>productVariantsBulkUpdate mutation</s-heading>
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre style={{ margin: 0 }}>
                  <code>{JSON.stringify(fetcher.data.variant, null, 2)}</code>
                </pre>
              </s-box>
            </s-stack>
          </s-section>
        )}
      </s-section>

      <s-section slot="aside" heading="App template specs">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <s-unordered-list>
          <s-list-item>
            Build an{" "}
            <s-link
              href="https://shopify.dev/docs/apps/getting-started/build-app-example"
              target="_blank"
            >
              example app
            </s-link>
          </s-list-item>
          <s-list-item>
            Explore Shopify&apos;s API with{" "}
            <s-link
              href="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
              target="_blank"
            >
              GraphiQL
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
