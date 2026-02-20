import { useState, useEffect } from "react";
import { useFetcher } from "react-router";

const BASE = "/mockup";

const defaultProductImages = [
  { id: "s1", src: `${BASE}/scene1-original.jpg`, label: "Image 1" },
  { id: "s2", src: `${BASE}/scene2-original.jpg`, label: "Image 2" },
  { id: "s3", src: `${BASE}/scene3-original.jpg`, label: "Image 3" },
];

export type ProductImageItem = { id: string; src: string; label?: string };

const boxStyle = {
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  minHeight: "200px",
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const twoPartLayout = {
  display: "grid" as const,
  gridTemplateColumns: "1fr 1fr",
  gap: "0",
  alignItems: "stretch" as const,
  position: "relative" as const,
  minHeight: "280px",
};

const stepDescriptionStyle = {
  margin: 0,
  marginTop: "4px",
  fontSize: "14px",
  color: "var(--p-color-text-subdued, #6d7175)",
  lineHeight: 1.4,
} as const;

function StepDescription({ step, total, title, description }: { step: number; total: number; title: string; description: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--p-color-text-primary, #202223)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Step {step} of {total}
      </p>
      <p style={{ ...stepDescriptionStyle, fontWeight: 600, color: "var(--p-color-text-primary, #202223)", marginTop: "2px" }}>
        {title}
      </p>
      <p style={stepDescriptionStyle}>
        {description}
      </p>
    </div>
  );
}

function FetchBackgroundModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const stockFetcher = useFetcher<StockImagesResponse>();

  const isLoading = stockFetcher.state === "loading" || stockFetcher.state === "submitting";
  const data = stockFetcher.data;
  const images = data?.success ? data.images : [];
  const isDemo = data?.source === "demo";
  const sources = data?.sources;
  const errors = data?.errors;
  const apiError = data && !data.success && "error" in data ? (data as { error?: string }).error : null;
  const total = data?.success ? data.total : 0;
  const perPage = data?.per_page ?? PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const displayPage = data?.success && data.page != null ? data.page : currentPage;

  const loadPage = (page: number) => {
    const q = query.trim();
    if (!q) return;
    stockFetcher.load(
      `${STOCK_IMAGES_API}?${new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE) }).toString()}`
    );
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadPage(1);
  };

  const handlePrev = () => {
    if (displayPage <= 1) return;
    const next = displayPage - 1;
    setCurrentPage(next);
    loadPage(next);
  };

  const handleNext = () => {
    if (displayPage >= totalPages) return;
    const next = displayPage + 1;
    setCurrentPage(next);
    loadPage(next);
  };

  const handleSelect = (img: (typeof images)[0]) => {
    const url = img.preview_url || img.download_url;
    if (url) {
      onSelect(url);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--p-color-bg-surface, #fff)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Fetch background</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              color: "#5c5f62",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search backgrounds (e.g. gradient, nature)"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              fontSize: "14px",
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: isLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
              color: "#fff",
              fontWeight: 600,
              cursor: !query.trim() || isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {apiError && (
          <div style={{ padding: "8px 20px", fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>
            {apiError}
          </div>
        )}

        {/* Per-source status: important when one or more APIs have no data or fail */}
        {(sources || errors) && !apiError && (
          <div
            style={{
              padding: "8px 20px",
              fontSize: "12px",
              color: "var(--p-color-text-subdued, #6d7175)",
              borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {isDemo && (
              <span style={{ color: "var(--p-color-text-caution, #b98900)" }}>
                No API keys set. Showing demo images. Add PEXELS_API_KEY and PIXABAY_API_KEY in .env for real search.
              </span>
            )}
            {!isDemo && (
              <>
                {sources?.pexels != null && (
                  <span>Pexels: {sources.pexels} image{sources.pexels !== 1 ? "s" : ""}</span>
                )}
                {sources?.pixabay != null && (
                  <span>Pixabay: {sources.pixabay} image{sources.pixabay !== 1 ? "s" : ""}</span>
                )}
                {errors?.pexels && (
                  <span style={{ color: "var(--p-color-text-critical, #d72c0d)" }}>Pexels: {errors.pexels}</span>
                )}
                {errors?.pixabay && (
                  <span style={{ color: "var(--p-color-text-critical, #d72c0d)" }}>Pixabay: {errors.pixabay}</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Pagination */}
        {data?.success && total > 0 && (
          <div
            style={{
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            }}
          >
            <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Page {displayPage} of {totalPages} ({total} result{total !== 1 ? "s" : ""})
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handlePrev}
                disabled={displayPage <= 1 || isLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "transparent",
                  cursor: displayPage <= 1 || isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={displayPage >= totalPages || isLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "transparent",
                  cursor: displayPage >= totalPages || isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            overflow: "auto",
            minHeight: "120px",
          }}
        >
          {isLoading && images.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Searching…
            </div>
          )}
          {!isLoading && images.length === 0 && data !== undefined && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              No images found. Try another search or check API keys.
            </div>
          )}
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => handleSelect(img)}
              style={{
                aspectRatio: "1",
                padding: 0,
                border: "2px solid var(--p-color-border-secondary, #e1e3e5)",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={img.thumbnail_url || img.preview_url || img.download_url}
                alt={img.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FetchVideoModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const stockFetcher = useFetcher<StockVideosResponse>();

  const isLoading = stockFetcher.state === "loading" || stockFetcher.state === "submitting";
  const data = stockFetcher.data;
  const videos = data?.success ? data.images : [];
  const sources = data?.sources;
  const errors = data?.errors;
  const apiError = data && !data.success && "error" in data ? (data as { error?: string }).error : null;
  const total = data?.success ? data.total : 0;
  const perPage = data?.per_page ?? PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const displayPage = data?.success && data.page != null ? data.page : currentPage;

  const loadPage = (page: number) => {
    const q = query.trim();
    if (!q) return;
    stockFetcher.load(
      `${STOCK_VIDEOS_API}?${new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE) }).toString()}`
    );
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadPage(1);
  };

  const handlePrev = () => {
    if (displayPage <= 1) return;
    const next = displayPage - 1;
    setCurrentPage(next);
    loadPage(next);
  };

  const handleNext = () => {
    if (displayPage >= totalPages) return;
    const next = displayPage + 1;
    setCurrentPage(next);
    loadPage(next);
  };

  const handleSelect = (item: (typeof videos)[0]) => {
    const url = item.preview_url || item.download_url;
    if (url) {
      onSelect(url);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--p-color-bg-surface, #fff)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Select stock video</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              color: "#5c5f62",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search videos (e.g. nature, office)"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              fontSize: "14px",
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: isLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
              color: "#fff",
              fontWeight: 600,
              cursor: !query.trim() || isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {apiError && (
          <div style={{ padding: "8px 20px", fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>
            {apiError}
          </div>
        )}

        {(sources || errors) && !apiError && (
          <div
            style={{
              padding: "8px 20px",
              fontSize: "12px",
              color: "var(--p-color-text-subdued, #6d7175)",
              borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {sources?.pexels != null && (
              <span>Pexels: {sources.pexels} video{sources.pexels !== 1 ? "s" : ""}</span>
            )}
            {sources?.pixabay != null && (
              <span>Pixabay: {sources.pixabay} video{sources.pixabay !== 1 ? "s" : ""}</span>
            )}
            {sources?.coverr != null && (
              <span>Coverr: {sources.coverr} video{sources.coverr !== 1 ? "s" : ""}</span>
            )}
            {errors?.pexels && (
              <span style={{ color: "var(--p-color-text-critical, #d72c0d)" }}>Pexels: {errors.pexels}</span>
            )}
            {errors?.pixabay && (
              <span style={{ color: "var(--p-color-text-critical, #d72c0d)" }}>Pixabay: {errors.pixabay}</span>
            )}
            {errors?.coverr && (
              <span style={{ color: "var(--p-color-text-critical, #d72c0d)" }}>Coverr: {errors.coverr}</span>
            )}
          </div>
        )}

        {data?.success && total > 0 && (
          <div
            style={{
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            }}
          >
            <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Page {displayPage} of {totalPages} ({total} result{total !== 1 ? "s" : ""})
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handlePrev}
                disabled={displayPage <= 1 || isLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "transparent",
                  cursor: displayPage <= 1 || isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={displayPage >= totalPages || isLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "transparent",
                  cursor: displayPage >= totalPages || isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            overflow: "auto",
            minHeight: "120px",
          }}
        >
          {isLoading && videos.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Searching…
            </div>
          )}
          {!isLoading && videos.length === 0 && data !== undefined && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              No videos found. Try another search or check API keys (PEXELS_API_KEY, PIXABAY_API_KEY, COVERR_API_KEY).
            </div>
          )}
          {videos.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              style={{
                aspectRatio: "16/9",
                padding: 0,
                border: "2px solid var(--p-color-border-secondary, #e1e3e5)",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={item.thumbnail_url || item.preview_url}
                alt={item.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type ShortInfo = {
  shortId: string | null;
  userId: string | null;
  scene1Id: string | null;
  scene2Id: string | null;
  scene3Id: string | null;
};

export type WorkflowProduct = { name: string; price?: string; rating?: number };

export function WorkflowModal({
  onClose,
  onDone,
  isSample,
  productImages: productImagesProp,
  productId,
  product,
}: {
  onClose: () => void;
  /** Called when user clicks Done after viewing the final video; pass the final video URL to add to product */
  onDone?: (videoUrl: string) => void;
  isSample: boolean;
  /** Product images from the store (real product). When empty or not provided, mockup images are used (e.g. sample product). */
  productImages?: ProductImageItem[];
  /** Product ID for temp save/restore (e.g. product.id). When set, workflow state is loaded on open and saved while in progress; temp is deleted when Done. */
  productId?: string | null;
  /** Product info for Remotion (scene 1 video generation). */
  product?: WorkflowProduct | null;
}) {
  const productImages = productImagesProp?.length ? productImagesProp : defaultProductImages;
  const firstImageId = productImages[0]?.id ?? "s1";

  const loadTempFetcher = useFetcher<{ state: WorkflowTempState | null }>();
  const loadShortFetcher = useFetcher<ShortInfo>();
  const saveTempFetcher = useFetcher();
  const deleteTempFetcher = useFetcher();

  const shortInfo: ShortInfo | null =
    loadShortFetcher.data != null
      ? {
          shortId: loadShortFetcher.data.shortId ?? null,
          userId: loadShortFetcher.data.userId ?? null,
          scene1Id: loadShortFetcher.data.scene1Id ?? null,
          scene2Id: loadShortFetcher.data.scene2Id ?? null,
          scene3Id: loadShortFetcher.data.scene3Id ?? null,
        }
      : null;

  const [loadedState, setLoadedState] = useState<WorkflowTempState | null | "pending">(null);
  const [activeTab, setActiveTab] = useState<"scene1" | "scene2" | "scene3">("scene1");
  const [scene1Complete, setScene1Complete] = useState(false);
  const [scene2Complete, setScene2Complete] = useState(false);
  const [scene3Complete, setScene3Complete] = useState(false);
  const [showingFinal, setShowingFinal] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const [scene1Snapshot, setScene1Snapshot] = useState<WorkflowTempState["scene1"] | null>(null);
  const [scene2Snapshot, setScene2Snapshot] = useState<WorkflowTempState["scene2"] | null>(null);
  const [scene3Snapshot, setScene3Snapshot] = useState<WorkflowTempState["scene3"] | null>(null);

  const allScenesComplete = scene1Complete && scene2Complete && scene3Complete;

  /** Restored state from temp (null while loading or when none saved) */
  const restoredState: WorkflowTempState | null =
    loadedState !== null && loadedState !== "pending" ? loadedState : null;

  // Load short + scene ids from DB when modal opens with productId
  useEffect(() => {
    if (productId?.trim() && loadShortFetcher.state === "idle" && !loadShortFetcher.data) {
      loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId.trim())}`);
    }
  }, [productId, loadShortFetcher.state, loadShortFetcher.data]);

  // Load temp when modal opens and we have productId
  useEffect(() => {
    if (productId?.trim() && loadTempFetcher.state === "idle" && !loadTempFetcher.data) {
      setLoadedState("pending");
      loadTempFetcher.load(`${WORKFLOW_TEMP_API}?productId=${encodeURIComponent(productId.trim())}`);
    }
  }, [productId, loadTempFetcher.state, loadTempFetcher.data]);

  useEffect(() => {
    if (loadTempFetcher.state !== "idle" || !loadTempFetcher.data) return;
    const data = loadTempFetcher.data;
    const state = data?.state ?? null;
    setLoadedState(state);
    if (state) {
      setActiveTab(state.activeTab);
      setScene1Complete(state.scene1Complete);
      setScene2Complete(state.scene2Complete);
      setScene3Complete(state.scene3Complete);
      setShowingFinal(state.showingFinal);
      setScriptGenerated(state.scriptGenerated);
      setAudioGenerated(state.audioGenerated);
      setScene1Snapshot(state.scene1);
      setScene2Snapshot(state.scene2);
      setScene3Snapshot(state.scene3);
    }
  }, [loadTempFetcher.state, loadTempFetcher.data]);

  // Debounced save while workflow is in progress (skip while still loading temp)
  useEffect(() => {
    if (!productId?.trim() || loadedState === "pending") return;
    const timer = setTimeout(() => {
      const state: WorkflowTempState = {
        activeTab,
        scene1Complete,
        scene2Complete,
        scene3Complete,
        showingFinal,
        scriptGenerated,
        audioGenerated,
        scene1: scene1Snapshot ?? defaultScene1State(firstImageId),
        scene2: scene2Snapshot ?? defaultScene2State(firstImageId),
        scene3: scene3Snapshot ?? defaultScene3State(firstImageId),
      };
      saveTempFetcher.submit(
        { productId: productId.trim(), state },
        { method: "post", action: WORKFLOW_TEMP_API, encType: "application/json" }
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [productId, loadedState, activeTab, scene1Complete, scene2Complete, scene3Complete, showingFinal, scriptGenerated, audioGenerated, scene1Snapshot, scene2Snapshot, scene3Snapshot, firstImageId]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--p-color-bg-surface, #fff)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxWidth: "900px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {showingFinal ? "Final promo video" : "Create promo video"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              color: "#5c5f62",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {showingFinal ? (
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", flex: 1 }}>
            <video
              src={`${BASE}/final.mp4`}
              controls
              style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: "12px", border: "1px solid #e1e3e5" }}
            />
            <button
              type="button"
              onClick={() => {
                if (productId?.trim()) {
                  deleteTempFetcher.submit(null, {
                    method: "delete",
                    action: `${WORKFLOW_TEMP_API}?productId=${encodeURIComponent(productId.trim())}`,
                  });
                }
                onDone?.(`${BASE}/final.mp4`);
                onClose();
              }}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: "var(--p-color-bg-fill-info, #2c6ecb)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : loadedState === "pending" ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Restoring progress…
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                padding: "0 20px",
              }}
            >
              {(["scene1", "scene2", "scene3"] as const).map((tab) => {
                const complete = tab === "scene1" ? scene1Complete : tab === "scene2" ? scene2Complete : scene3Complete;
                const label = tab === "scene1" ? "Scene 1" : tab === "scene2" ? "Scene 2" : "Scene 3";
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "14px 20px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: activeTab === tab ? "var(--p-color-text-primary, #202223)" : "var(--p-color-text-subdued, #6d7175)",
                      borderBottom: activeTab === tab ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid transparent",
                      marginBottom: "-1px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {label}
                    {complete && (
                      <span style={{ color: "var(--p-color-text-success, #008060)", fontSize: "16px" }} title="Complete">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {allScenesComplete && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>Audio script & voiceover (optional)</p>
                {!scriptGenerated ? (
                  <button
                    type="button"
                    onClick={() => setScriptGenerated(true)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--p-color-bg-fill-info, #2c6ecb)",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    Generate script
                  </button>
                ) : (
                  <>
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: "#fff",
                        border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                        marginBottom: "12px",
                        fontSize: "14px",
                        lineHeight: 1.5,
                        color: "var(--p-color-text-primary, #202223)",
                      }}
                    >
                      Ready to take your snow game to the next level? Meet the Agog Sports SLOPEDECK! This isn&apos;t just a snowskate; it&apos;s your ticket to carving turns like a pro, whether you&apos;re a beginner or an expert. Perfect for kids and adults alike, it makes snowy adventures more thrilling and fun. Grab yours today and feel the excitement!
                    </div>
                    {!audioGenerated ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAudioLoading(true);
                          setTimeout(() => {
                            setAudioGenerated(true);
                            setAudioLoading(false);
                          }, 1500);
                        }}
                        disabled={audioLoading}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "8px",
                          border: "none",
                          background: audioLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                          color: "#fff",
                          fontWeight: 600,
                          cursor: audioLoading ? "wait" : "pointer",
                          fontSize: "14px",
                        }}
                      >
                        {audioLoading ? "Generating…" : "Generate audio"}
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <audio src={`${BASE}/audio.mp3`} controls style={{ maxWidth: "100%" }} />
                        <span style={{ fontSize: "14px", color: "var(--p-color-text-success, #008060)", fontWeight: 600 }}>✓ Audio ready</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {allScenesComplete && (
              <div
                style={{
                  padding: "12px 20px",
                  background: "var(--p-color-bg-fill-success-secondary, #e3f1df)",
                  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowingFinal(true)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--p-color-bg-fill-success, #008060)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Finalize
                </button>
              </div>
            )}

            <div style={{ padding: "20px", overflow: "auto", flex: 1 }}>
              <div style={{ display: activeTab === "scene1" ? "block" : "none" }} key={`scene1-${restoredState?.scene1 ? "restored" : "default"}`}>
                <Scene1Content
                  productImages={productImages}
                  productId={productId ?? undefined}
                  product={product ?? undefined}
                  sceneId={shortInfo?.scene1Id ?? undefined}
                  shortId={shortInfo?.shortId ?? undefined}
                  shortUserId={shortInfo?.userId ?? undefined}
                  initialScene1={restoredState?.scene1}
                  onScene1Change={setScene1Snapshot}
                  onComplete={() => setScene1Complete(true)}
                />
              </div>
              <div style={{ display: activeTab === "scene2" ? "block" : "none" }} key={`scene2-${restoredState?.scene2 ? "restored" : "default"}`}>
                <Scene2Content
                  productImages={productImages}
                  initialScene2={restoredState?.scene2}
                  onScene2Change={setScene2Snapshot}
                  onComplete={() => setScene2Complete(true)}
                />
              </div>
              <div style={{ display: activeTab === "scene3" ? "block" : "none" }} key={`scene3-${restoredState?.scene3 ? "restored" : "default"}`}>
                <Scene3Content
                  productImages={productImages}
                  productId={productId ?? undefined}
                  sceneId={shortInfo?.scene3Id ?? undefined}
                  shortUserId={shortInfo?.userId ?? undefined}
                  initialScene3={restoredState?.scene3}
                  onScene3Change={setScene3Snapshot}
                  onComplete={() => setScene3Complete(true)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const VIDEO_API = "/app/api/video";
const STOCK_IMAGES_API = "/app/api/stock/images";
const STOCK_VIDEOS_API = "/app/api/stock/videos";
const WORKFLOW_TEMP_API = "/app/api/promo-workflow-temp";
const COMPOSITE_API = "/app/api/image/composite";
const SHORTS_API = "/app/api/shorts";
const SHORTS_SCENES_API = "/app/api/shorts/scenes";
const REMOTION_START_API = "/app/api/remotion/start";
const TASKS_API_BASE = "/app/api/tasks";
const PER_PAGE = 12;
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // 5 min at 5s

/** Response shape from POST /app/api/image/composite (JSON only) */
type CompositeApiResponse = {
  success: boolean;
  image_url: string | null;
  error: string | null;
  message?: string;
  created_at?: string;
};

/** Parses the composite API JSON response. */
async function parseCompositeApiResponse(
  res: Response
): Promise<{ ok: true; image_url: string } | { ok: false; error: string }> {
  const raw = await res.text();
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  let data: CompositeApiResponse;
  try {
    data = trimmed ? JSON.parse(trimmed) : ({} as CompositeApiResponse);
  } catch (e) {
    console.error("[Composite] Response is not valid JSON. Status:", res.status, "Content-Type:", res.headers.get("Content-Type"), "Body (first 400 chars):", raw.slice(0, 400));
    return { ok: false, error: "Server returned invalid response. Try again." };
  }
  if (data.success && typeof data.image_url === "string" && data.image_url.trim()) {
    let image_url = data.image_url.trim();
    // Normalize: public/composited_images/... is served at /composited_images/...
    if (!image_url.startsWith("http") && !image_url.startsWith("/")) {
      image_url = `/${image_url}`;
    }
    return { ok: true, image_url };
  }
  const errorMessage =
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    "Compositing failed";
  return { ok: false, error: errorMessage };
}

/** Serializable workflow state for temp save/restore (matches server WorkflowTempState) */
export type WorkflowTempState = {
  activeTab: "scene1" | "scene2" | "scene3";
  scene1Complete: boolean;
  scene2Complete: boolean;
  scene3Complete: boolean;
  showingFinal: boolean;
  scriptGenerated: boolean;
  audioGenerated: boolean;
  scene1: { step: number; selectedImage: string | null; bgRemoved: string | null; bgImage: string | null; composited: string | null; sceneVideo: string | null };
  scene2: { step: number; selectedImage: string | null; bgRemoved: string | null; selectedStockVideoUrl: string | null; sceneVideo: string | null };
  scene3: { step: number; selectedImage: string | null; bgRemoved: string | null; bgImage: string | null; composited: string | null; sceneVideo: string | null };
};

const defaultScene1State = (firstImageId: string): WorkflowTempState["scene1"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  bgImage: null,
  composited: null,
  sceneVideo: null,
});
const defaultScene2State = (firstImageId: string): WorkflowTempState["scene2"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  selectedStockVideoUrl: null,
  sceneVideo: null,
});
const defaultScene3State = (firstImageId: string): WorkflowTempState["scene3"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  bgImage: null,
  composited: null,
  sceneVideo: null,
});

/** Response shape from GET /app/api/stock/images (for FetchBackgroundModal) */
interface StockImagesResponse {
  success: boolean;
  images: Array<{
    id: string;
    title: string;
    thumbnail_url?: string;
    preview_url?: string;
    download_url?: string;
    type?: string;
  }>;
  total: number;
  page: number;
  per_page: number;
  source?: "demo";
  sources?: { pexels?: number; pixabay?: number; coverr?: number };
  errors?: { pexels?: string; pixabay?: string; coverr?: string };
}

/** Same shape for video search (FetchVideoModal) */
type StockVideosResponse = StockImagesResponse;

type Scene1State = WorkflowTempState["scene1"];

function Scene1Content({
  productImages: productImagesProp,
  productId,
  product: productProp,
  sceneId: videoSceneId,
  shortId,
  shortUserId,
  initialScene1,
  onScene1Change,
  onComplete,
}: {
  productImages: ProductImageItem[];
  productId?: string | null;
  product?: WorkflowProduct | null;
  sceneId?: string | null;
  shortId?: string | null;
  shortUserId?: string | null;
  initialScene1?: Scene1State | null;
  onScene1Change?: (s: Scene1State) => void;
  onComplete?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene1?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene1?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene1?.bgRemoved ?? null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(initialScene1?.bgImage ?? null);
  const [bgLoading, setBgLoading] = useState(false);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [composited, setComposited] = useState<string | null>(initialScene1?.composited ?? null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [compositeError, setCompositeError] = useState<string | null>(null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(initialScene1?.sceneVideo ?? null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneProgress, setSceneProgress] = useState<number | null>(null);

  useEffect(() => {
    onScene1Change?.({
      step,
      selectedImage,
      bgRemoved,
      bgImage,
      composited,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, bgImage, composited, sceneVideo, onScene1Change]);

  const removeBgFetcher = useFetcher<{ ok: boolean; url?: string; error?: string }>();

  useEffect(() => {
    if (removeBgFetcher.state !== "idle" || !removeBgFetcher.data) return;
    setBgRemovedLoading(false);
    const data = removeBgFetcher.data;
    if (data.ok && data.url) {
      setBgRemoved(data.url);
      setBgRemovedError(null);
    } else {
      setBgRemovedError(data.error ?? "Remove BG failed");
    }
  }, [removeBgFetcher.state, removeBgFetcher.data]);

  const handleRemoveBg = () => {
    const img = productImagesProp.find((i) => i.id === selectedImage);
    const imageUrl = img?.src;
    if (!imageUrl) {
      setBgRemovedError("No image selected");
      return;
    }
    setBgRemovedError(null);
    setBgRemovedLoading(true);
    removeBgFetcher.submit(
      { step: "removeBg", imageUrl },
      { method: "post", action: VIDEO_API, encType: "application/json" }
    );
  };

  const handleGenerateBg = () => {
    setBgLoading(true);
    setTimeout(() => {
      setBgImage(`${BASE}/scene1-bg.png`);
      setBgLoading(false);
    }, 1000);
  };

  const handleComposite = async () => {
    if (!bgRemoved || !bgImage) return;
    setCompositeError(null);
    setCompositeLoading(true);
    const sceneLabel = "Scene 1";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const overlayUrl = bgRemoved.startsWith("http") ? bgRemoved : `${origin}${bgRemoved}`;
      const backgroundUrl = bgImage.startsWith("http") ? bgImage : `${origin}${bgImage}`;
      const scene_id = videoSceneId ?? (productId ? `${productId}-scene1` : `scene1-${Date.now()}`);
      const user_id = shortUserId ?? "anonymous";
      const payload = {
        background_url: backgroundUrl,
        overlay_url: overlayUrl,
        scene_id,
        user_id,
      };
      console.log(`[Composite] ${sceneLabel}: user clicked Composite → sending POST to ${COMPOSITE_API}`, {
        scene_id,
        user_id,
        overlay_url: overlayUrl,
        background_url: backgroundUrl,
      });
      const res = await fetch(COMPOSITE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
        cache: "no-store",
      });
      const result = await parseCompositeApiResponse(res);
      console.log(`[Composite] ${sceneLabel}: parsed result`, result);
      if (result.ok) {
        setComposited(result.image_url);
        console.log(`[Composite] ${sceneLabel}: success → composited image URL:`, result.image_url);
      } else {
        setCompositeError(result.error);
        console.warn(`[Composite] ${sceneLabel}: failed`, result.error);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Compositing failed";
      setCompositeError(errMsg);
      console.error(`[Composite] ${sceneLabel}: request error`, e);
    } finally {
      setCompositeLoading(false);
    }
  };

  const handleGenerateScene = async () => {
    if (!composited) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullImageUrl = composited.startsWith("http") ? composited : `${origin}${composited}`;
    if (!shortId || !shortUserId) {
      setSceneError("Short not loaded. Please close and reopen the workflow.");
      return;
    }
    setSceneError(null);
    setSceneProgress(0);
    setSceneLoading(true);
    try {
      const startRes = await fetch(REMOTION_START_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          shortId,
          sceneId: videoSceneId ?? undefined,
          imageUrl: fullImageUrl,
          product: {
            name: productProp?.name ?? "Product",
            price: productProp?.price ?? "$0.00",
            rating: productProp?.rating ?? 0,
          },
        }),
      });
      const startData = await startRes.json().catch(() => ({}));
      const taskId = startData.taskId;
      if (!taskId) {
        setSceneError(startData.error ?? "Failed to start video generation");
        setSceneLoading(false);
        return;
      }
      let done = false;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const pollRes = await fetch(`${TASKS_API_BASE}/${encodeURIComponent(taskId)}`, {
          credentials: "include",
        });
        const task = await pollRes.json().catch(() => ({}));
        setSceneProgress(task.progress ?? null);
        if (task.status === "completed" && task.videoUrl) {
          const videoUrl = task.videoUrl.startsWith("http") ? task.videoUrl : `${origin}${task.videoUrl}`;
          setSceneVideo(videoUrl);
          setSceneError(null);
          onComplete?.();
          done = true;
          break;
        }
        if (task.status === "failed") {
          setSceneError(task.error ?? "Video generation failed");
          done = true;
          break;
        }
      }
      if (!done) {
        setSceneError("Video generation timed out. Please try again.");
      }
    } catch (e) {
      setSceneError(e instanceof Error ? e.message : "Video generation failed");
    } finally {
      setSceneLoading(false);
      setSceneProgress(null);
    }
  };

  const handleNextStepAfterComposite = async () => {
    if (videoSceneId && composited) {
      try {
        await fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: videoSceneId, imageUrl: composited }),
        });
      } catch (e) {
        console.error("[Composite] Failed to save composited URL to scene:", e);
      }
    }
    setStep(3);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <StepDescription
            step={1}
            total={3}
            title="Select image & remove background"
            description="Choose one of the product images below, then click Remove BG to strip the background. The result will be used as the subject for this scene."
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {productImagesProp.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImage(img.id)}
                style={{
                  padding: 0,
                  border: selectedImage === img.id ? "3px solid var(--p-color-border-info, #2c6ecb)" : "2px solid #e1e3e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                <img src={img.src} alt={img.label ?? ""} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handleRemoveBg}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--p-color-bg-fill-info, #2c6ecb)",
                color: "#fff",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              {bgRemovedLoading ? "Removing…" : "Remove BG"}
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {bgRemoved && (
              <>
                <img
                  src={bgRemoved}
                  alt="BG removed"
                  style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }}
                />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Next step →
                </button>
              </>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <StepDescription
            step={2}
            total={3}
            title="Add a background"
            description="Generate a new background with AI or fetch one from the library. Then click Composite to combine the subject with the chosen background."
          />
          <div style={twoPartLayout}>
            <div style={{ ...boxStyle, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              {bgRemoved ? (
                <img src={bgRemoved} alt="BG removed" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, position: "relative" }}>
              {bgLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <span className="spinner" style={{ width: 32, height: 32, border: "3px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "14px", color: "#6d7175" }}>Generating background…</span>
                </div>
              ) : null}
              {!bgImage && !bgLoading && (
                <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 1 }}>
                  <button
                    type="button"
                    onClick={handleGenerateBg}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(44, 110, 203, 0.5)",
                      background: "rgba(44, 110, 203, 0.3)",
                      color: "#2c6ecb",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    Generate background
                  </button>
                  <button
                    type="button"
                    onClick={() => setFetchModalOpen(true)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px dashed rgba(44, 110, 203, 0.5)",
                      background: "rgba(44, 110, 203, 0.3)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px",
                      color: "#2c6ecb",
                    }}
                  >
                    Fetch background
                  </button>
                </div>
              )}
              {bgImage ? (
                <img src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <FetchBackgroundModal
              open={fetchModalOpen}
              onClose={() => setFetchModalOpen(false)}
              onSelect={(url) => setBgImage(url)}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 2,
              }}
            >
              <button
                type="button"
                onClick={handleComposite}
                disabled={!bgImage || compositeLoading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: compositeLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: !bgImage || compositeLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {compositeLoading ? "Compositing…" : "Composite"}
              </button>
            </div>
          </div>
          {compositeLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
              <span className="spinner" style={{ width: 24, height: 24, border: "2px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: "14px", color: "#6d7175" }}>Compositing…</span>
            </div>
          )}
          {compositeError && (
            <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{compositeError}</span>
          )}
          {composited && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={composited} alt="Composited" style={{ width: "200px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
              <button
                type="button"
                onClick={handleNextStepAfterComposite}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next step →
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <StepDescription
            step={3}
            total={3}
            title="Generate scene video"
            description="Create the final ~8 second video for this scene from the composited image using Remotion. Click Generate scene to start."
          />
          <div style={twoPartLayout}>
            <div style={{ ...boxStyle, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              {composited ? (
                <img src={composited} alt="Composited" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : (
                <img src={`${BASE}/scene1-composited.png`} alt="Composited" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              )}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
              {sceneLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <span className="spinner" style={{ width: 32, height: 32, border: "3px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "14px", color: "#6d7175" }}>
                    Generating scene video…{sceneProgress != null ? ` ${sceneProgress}%` : ""}
                  </span>
                </div>
              ) : sceneError ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{sceneError}</span>
                  <button
                    type="button"
                    onClick={() => { setSceneError(null); handleGenerateScene(); }}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--p-color-bg-fill-info, #2c6ecb)",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : sceneVideo ? (
                <video src={sceneVideo} controls style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateScene}
                  disabled={!composited}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: composited ? "var(--p-color-bg-fill-info, #2c6ecb)" : "#ccc",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: composited ? "pointer" : "not-allowed",
                  }}
                >
                  Generate scene
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type Scene2State = WorkflowTempState["scene2"];

function Scene2Content({
  productImages: productImagesProp,
  initialScene2,
  onScene2Change,
  onComplete,
}: {
  productImages: ProductImageItem[];
  initialScene2?: Scene2State | null;
  onScene2Change?: (s: Scene2State) => void;
  onComplete?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene2?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene2?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene2?.bgRemoved ?? null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedStockVideoUrl, setSelectedStockVideoUrl] = useState<string | null>(initialScene2?.selectedStockVideoUrl ?? null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(initialScene2?.sceneVideo ?? null);
  const [sceneLoading, setSceneLoading] = useState(false);

  useEffect(() => {
    onScene2Change?.({
      step,
      selectedImage,
      bgRemoved,
      selectedStockVideoUrl,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, selectedStockVideoUrl, sceneVideo, onScene2Change]);

  const removeBgFetcher = useFetcher<{ ok: boolean; url?: string; error?: string }>();

  useEffect(() => {
    if (removeBgFetcher.state !== "idle" || !removeBgFetcher.data) return;
    setBgRemovedLoading(false);
    const data = removeBgFetcher.data;
    if (data.ok && data.url) {
      setBgRemoved(data.url);
      setBgRemovedError(null);
    } else {
      setBgRemovedError(data.error ?? "Remove BG failed");
    }
  }, [removeBgFetcher.state, removeBgFetcher.data]);

  const handleRemoveBg = () => {
    const img = productImagesProp.find((i) => i.id === selectedImage);
    const imageUrl = img?.src;
    if (!imageUrl) {
      setBgRemovedError("No image selected");
      return;
    }
    setBgRemovedError(null);
    setBgRemovedLoading(true);
    removeBgFetcher.submit(
      { step: "removeBg", imageUrl },
      { method: "post", action: VIDEO_API, encType: "application/json" }
    );
  };

  const handleGenerateVideo = () => {
    setSceneLoading(true);
    setTimeout(() => {
      setSceneVideo(`${BASE}/scene2-video.mp4`);
      setSceneLoading(false);
      onComplete?.();
    }, 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <StepDescription
            step={1}
            total={2}
            title="Select image & remove background"
            description="Choose a product image and remove its background. The result will be composited onto a stock video in the next step."
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {productImagesProp.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImage(img.id)}
                style={{
                  padding: 0,
                  border: selectedImage === img.id ? "3px solid var(--p-color-border-info, #2c6ecb)" : "2px solid #e1e3e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                <img src={img.src} alt={img.label ?? ""} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handleRemoveBg}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--p-color-bg-fill-info, #2c6ecb)",
                color: "#fff",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              {bgRemovedLoading ? "Removing…" : "Remove BG"}
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {bgRemoved && (
              <>
                <img src={bgRemoved} alt="BG removed" style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Next step →
                </button>
              </>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <StepDescription
            step={2}
            total={2}
            title="Select stock video & generate scene"
            description="Search and pick a stock video from Pexels, Pixabay, or Coverr as the background. Then click Generate video to composite your subject onto it and create the scene (~8s)."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              type="button"
              onClick={() => setVideoModalOpen(true)}
              style={{
                ...boxStyle,
                minHeight: "60px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selectedStockVideoUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <video
                    src={selectedStockVideoUrl}
                    style={{ width: "120px", height: "68px", objectFit: "cover", borderRadius: "6px" }}
                    muted
                    playsInline
                  />
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-primary, #202223)" }}>Stock video selected</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVideoModalOpen(true); }}
                    style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #e1e3e5", background: "#fff", cursor: "pointer" }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Search stock videos (Pexels, Pixabay, Coverr)</span>
              )}
            </button>
          </div>
          <FetchVideoModal
            open={videoModalOpen}
            onClose={() => setVideoModalOpen(false)}
            onSelect={(url) => { setSelectedStockVideoUrl(url); setVideoModalOpen(false); }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {sceneLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="spinner" style={{ width: 24, height: 24, border: "2px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: "14px", color: "#6d7175" }}>Generating video…</span>
              </div>
            ) : sceneVideo ? (
              <video src={sceneVideo} controls style={{ maxWidth: "400px", maxHeight: "240px", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
            ) : (
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={!selectedStockVideoUrl}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: !selectedStockVideoUrl ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: !selectedStockVideoUrl ? "not-allowed" : "pointer",
                }}
              >
                Generate video
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type Scene3State = WorkflowTempState["scene3"];

function Scene3Content({
  productImages: productImagesProp,
  productId,
  sceneId: videoSceneId,
  shortUserId,
  initialScene3,
  onScene3Change,
  onComplete,
}: {
  productImages: ProductImageItem[];
  productId?: string | null;
  sceneId?: string | null;
  shortUserId?: string | null;
  initialScene3?: Scene3State | null;
  onScene3Change?: (s: Scene3State) => void;
  onComplete?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene3?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene3?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene3?.bgRemoved ?? null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(initialScene3?.bgImage ?? null);
  const [bgLoading, setBgLoading] = useState(false);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [composited, setComposited] = useState<string | null>(initialScene3?.composited ?? null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [compositeError, setCompositeError] = useState<string | null>(null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(initialScene3?.sceneVideo ?? null);
  const [sceneLoading, setSceneLoading] = useState(false);

  useEffect(() => {
    onScene3Change?.({
      step,
      selectedImage,
      bgRemoved,
      bgImage,
      composited,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, bgImage, composited, sceneVideo, onScene3Change]);

  const removeBgFetcher = useFetcher<{ ok: boolean; url?: string; error?: string }>();

  useEffect(() => {
    if (removeBgFetcher.state !== "idle" || !removeBgFetcher.data) return;
    setBgRemovedLoading(false);
    const data = removeBgFetcher.data;
    if (data.ok && data.url) {
      setBgRemoved(data.url);
      setBgRemovedError(null);
    } else {
      setBgRemovedError(data.error ?? "Remove BG failed");
    }
  }, [removeBgFetcher.state, removeBgFetcher.data]);

  const handleRemoveBg = () => {
    const img = productImagesProp.find((i) => i.id === selectedImage);
    const imageUrl = img?.src;
    if (!imageUrl) {
      setBgRemovedError("No image selected");
      return;
    }
    setBgRemovedError(null);
    setBgRemovedLoading(true);
    removeBgFetcher.submit(
      { step: "removeBg", imageUrl },
      { method: "post", action: VIDEO_API, encType: "application/json" }
    );
  };

  const handleGenerateBg = () => {
    setBgLoading(true);
    setTimeout(() => {
      setBgImage(`${BASE}/scene3-bg.png`);
      setBgLoading(false);
    }, 1000);
  };

  const handleComposite = async () => {
    if (!bgRemoved || !bgImage) return;
    setCompositeError(null);
    setCompositeLoading(true);
    const sceneLabel = "Scene 3";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const overlayUrl = bgRemoved.startsWith("http") ? bgRemoved : `${origin}${bgRemoved}`;
      const backgroundUrl = bgImage.startsWith("http") ? bgImage : `${origin}${bgImage}`;
      const scene_id = videoSceneId ?? (productId ? `${productId}-scene3` : `scene3-${Date.now()}`);
      const user_id = shortUserId ?? "anonymous";
      const payload = {
        background_url: backgroundUrl,
        overlay_url: overlayUrl,
        scene_id,
        user_id,
      };
      console.log(`[Composite] ${sceneLabel}: user clicked Composite → sending POST to ${COMPOSITE_API}`, {
        scene_id,
        user_id,
        overlay_url: overlayUrl,
        background_url: backgroundUrl,
      });
      const res = await fetch(COMPOSITE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
        cache: "no-store",
      });
      const result = await parseCompositeApiResponse(res);
      console.log(`[Composite] ${sceneLabel}: parsed result`, result);
      if (result.ok) {
        setComposited(result.image_url);
        console.log(`[Composite] ${sceneLabel}: success → composited image URL:`, result.image_url);
      } else {
        setCompositeError(result.error);
        console.warn(`[Composite] ${sceneLabel}: failed`, result.error);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Compositing failed";
      setCompositeError(errMsg);
      console.error(`[Composite] ${sceneLabel}: request error`, e);
    } finally {
      setCompositeLoading(false);
    }
  };

  const handleGenerateScene = () => {
    setSceneLoading(true);
    setTimeout(() => {
      setSceneVideo(`${BASE}/scene3-video.mp4`);
      setSceneLoading(false);
      onComplete?.();
    }, 2000);
  };

  const handleNextStepAfterComposite = async () => {
    if (videoSceneId && composited) {
      try {
        await fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: videoSceneId, imageUrl: composited }),
        });
      } catch (e) {
        console.error("[Composite] Failed to save composited URL to scene:", e);
      }
    }
    setStep(3);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <StepDescription
            step={1}
            total={3}
            title="Select image & remove background"
            description="Choose one of the product images, then click Remove BG. The result will be used as the subject for this scene (same flow as Scene 1)."
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {productImagesProp.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImage(img.id)}
                style={{
                  padding: 0,
                  border: selectedImage === img.id ? "3px solid var(--p-color-border-info, #2c6ecb)" : "2px solid #e1e3e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                }}
              >
                <img src={img.src} alt={img.label ?? ""} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handleRemoveBg}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--p-color-bg-fill-info, #2c6ecb)",
                color: "#fff",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              {bgRemovedLoading ? "Removing…" : "Remove BG"}
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {bgRemoved && (
              <>
                <img src={bgRemoved} alt="BG removed" style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Next step →
                </button>
              </>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <StepDescription
            step={2}
            total={3}
            title="Add a background (Scene 3 style)"
            description="Generate a new background or fetch one from the library. Then click Composite to combine the subject with the chosen background. A different Remotion style will be applied in the next step."
          />
          <div style={twoPartLayout}>
            <div style={{ ...boxStyle, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              {bgRemoved ? (
                <img src={bgRemoved} alt="BG removed" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, position: "relative" }}>
              {bgLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <span className="spinner" style={{ width: 32, height: 32, border: "3px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "14px", color: "#6d7175" }}>Generating background…</span>
                </div>
              ) : null}
              {!bgImage && !bgLoading && (
                <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 1 }}>
                  <button
                    type="button"
                    onClick={handleGenerateBg}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(44, 110, 203, 0.5)",
                      background: "rgba(44, 110, 203, 0.3)",
                      color: "#2c6ecb",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    Generate background
                  </button>
                  <button
                    type="button"
                    onClick={() => setFetchModalOpen(true)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px dashed rgba(44, 110, 203, 0.5)",
                      background: "rgba(44, 110, 203, 0.3)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "12px",
                      color: "#2c6ecb",
                    }}
                  >
                    Fetch background
                  </button>
                </div>
              )}
              {bgImage ? (
                <img src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <FetchBackgroundModal
              open={fetchModalOpen}
              onClose={() => setFetchModalOpen(false)}
              onSelect={(url) => setBgImage(url)}
            />
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 2 }}>
              <button
                type="button"
                onClick={handleComposite}
                disabled={!bgImage || compositeLoading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: compositeLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: !bgImage || compositeLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {compositeLoading ? "Compositing…" : "Composite"}
              </button>
            </div>
          </div>
          {compositeLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
              <span className="spinner" style={{ width: 24, height: 24, border: "2px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: "14px", color: "#6d7175" }}>Compositing…</span>
            </div>
          )}
          {compositeError && (
            <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{compositeError}</span>
          )}
          {composited && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={composited} alt="Composited" style={{ width: "200px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
              <button
                type="button"
                onClick={handleNextStepAfterComposite}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next step →
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <StepDescription
            step={3}
            total={3}
            title="Generate scene video (different style)"
            description="Create the ~8 second video for this scene from the composited image using Remotion with a different style than Scene 1. Click Generate scene to start."
          />
          <div style={twoPartLayout}>
            <div style={{ ...boxStyle, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              {composited ? (
                <img src={composited} alt="Composited" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : (
                <img src={`${BASE}/scene3-compositied.png`} alt="Composited" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              )}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
              {sceneLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <span className="spinner" style={{ width: 32, height: 32, border: "3px solid #e1e3e5", borderTopColor: "#2c6ecb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "14px", color: "#6d7175" }}>Generating scene video…</span>
                </div>
              ) : sceneVideo ? (
                <video src={sceneVideo} controls style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateScene}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Generate scene
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
