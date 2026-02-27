import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { Link } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export type VideoItem = {
  id: string;
  title: string;
  productId: string | null;
  finalVideoUrl: string | null;
  createdAt: Date;
  thumbnailUrl: string | null;
};

export type ProductFilterOption = {
  productId: string;
  title: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = (session as { shop?: string }).shop?.trim() ?? "";

  const url = new URL(request.url);
  const productIdFilter = url.searchParams.get("productId")?.trim() || null;

  let videos: VideoItem[] = [];
  let productFilterOptions: ProductFilterOption[] = [];

  if (shop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shortDelegate = (prisma as any).short;
    if (shortDelegate) {
      const where: {
        userId: string;
        status: string;
        productId?: string;
        finalVideoUrl?: { not: null };
      } = {
        userId: shop,
        status: "ready",
        finalVideoUrl: { not: null },
      };
      if (productIdFilter) {
        where.productId = productIdFilter;
      }

      const list = await shortDelegate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          productId: true,
          finalVideoUrl: true,
          createdAt: true,
          scenes: {
            take: 1,
            orderBy: { sceneNumber: "asc" },
            select: { imageUrl: true, generatedVideoUrl: true },
          },
        },
      }) as {
        id: string;
        title: string;
        productId: string | null;
        finalVideoUrl: string | null;
        createdAt: Date;
        scenes: { imageUrl: string | null; generatedVideoUrl: string | null }[];
      }[];

      videos = (list ?? []).map((s) => {
        const thumb =
          s.finalVideoUrl?.trim() ||
          s.scenes?.[0]?.generatedVideoUrl?.trim() ||
          s.scenes?.[0]?.imageUrl?.trim() ||
          null;
        return {
          id: s.id,
          title: s.title,
          productId: s.productId,
          finalVideoUrl: s.finalVideoUrl?.trim() || null,
          createdAt: s.createdAt,
          thumbnailUrl: thumb,
        };
      });

      const allReady = await shortDelegate.findMany({
        where: { userId: shop, status: "ready", finalVideoUrl: { not: null } },
        select: { productId: true, title: true },
      }) as { productId: string | null; title: string }[];
      const seen = new Set<string>();
      for (const row of allReady ?? []) {
        if (row.productId && !seen.has(row.productId)) {
          seen.add(row.productId);
          productFilterOptions.push({
            productId: row.productId,
            title: row.title || "Untitled",
          });
        }
      }
    }
  }

  return {
    videos,
    productFilterOptions,
    currentProductId: productIdFilter,
  };
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyVideosPage() {
  const { videos, productFilterOptions, currentProductId } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      searchParams.delete("productId");
    } else {
      searchParams.set("productId", value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <s-page heading="My Videos">
      <s-section heading="All created videos">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <s-text>Filter by product:</s-text>
          <select
            value={currentProductId ?? ""}
            onChange={handleFilterChange}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              background: "var(--p-color-bg-surface-primary, #fff)",
              fontSize: "14px",
              minWidth: "200px",
            }}
          >
            <option value="">All products</option>
            {productFilterOptions.map((opt) => (
              <option key={opt.productId} value={opt.productId}>
                {opt.title}
              </option>
            ))}
          </select>
        </div>

        {videos.length === 0 ? (
          <div
            style={{
              padding: "24px",
              background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              borderRadius: "8px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            }}
          >
            <s-text type="strong">No videos yet</s-text>
            <div style={{ marginTop: "8px" }}>
              <s-paragraph color="subdued">
                Create one from the Dashboard.
              </s-paragraph>
            </div>
            <div style={{ marginTop: "12px" }}>
              <Link to="/app">
                <s-button variant="primary">Go to Dashboard</s-button>
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {videos.map((v) => (
              <div
                key={v.id}
                style={{
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16/9",
                    background: "var(--p-color-bg-fill-tertiary, #f0f0f0)",
                  }}
                >
                  {v.thumbnailUrl ? (
                    v.thumbnailUrl.match(/\.(mp4|webm|mov)$/i) ? (
                      <video
                        src={v.thumbnailUrl}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )
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
                      No preview
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <s-text type="strong">{v.title}</s-text>
                  </div>
                  <s-text
                    color="subdued"
                    style={{ display: "block", marginTop: "4px", fontSize: "12px" }}
                  >
                    {formatDate(v.createdAt)}
                  </s-text>
                  {v.finalVideoUrl && (
                    <a
                      href={v.finalVideoUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none", marginTop: "8px", display: "inline-block" }}
                    >
                      <s-button variant="primary" size="slim">
                        Download
                      </s-button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}
