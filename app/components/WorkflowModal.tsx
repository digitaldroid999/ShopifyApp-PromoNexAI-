import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

const BASE = "/mockup";
const BACKGROUND_EXTRACT_PROMPT_API = "/app/api/background/extract-prompt";
const BACKGROUND_GENERATE_API = "/app/api/background/generate";
const BACKGROUND_STATUS_API_BASE = "/app/api/background/status";
const BACKGROUND_POLL_INTERVAL_MS = 2500;
const BACKGROUND_POLL_MAX_ATTEMPTS = 60;

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

const MOODS = [
  { value: "energetic", label: "Energetic", icon: "⚡" },
  { value: "friendly", label: "Friendly", icon: "🤗" },
  { value: "inspiring", label: "Inspiring", icon: "🌟" },
  { value: "dramatic", label: "Dramatic", icon: "🎭" },
  { value: "bold", label: "Bold", icon: "💪" },
  { value: "relaxed", label: "Relaxed", icon: "😌" },
  { value: "quirky", label: "Quirky", icon: "🎪" },
  { value: "romantic", label: "Romantic", icon: "💕" },
  { value: "mysterious", label: "Mysterious", icon: "🌙" },
  { value: "comic", label: "Comic", icon: "😂" },
];

const STYLES = [
  { value: "trendy-influencer", label: "Trendy Influencer", icon: "📱", category: "Social Media Native" },
  { value: "lifestyle-aesthetic", label: "Lifestyle Aesthetic", icon: "🌸", category: "Social Media Native" },
  { value: "fast-cut-hype", label: "Fast-Cut Hype", icon: "⚡", category: "Social Media Native" },
  { value: "documentary-style", label: "Documentary-Style", icon: "🎬", category: "Cinematic" },
  { value: "cinematic-ad", label: "Cinematic Ad", icon: "🎭", category: "Cinematic" },
  { value: "luxury-commercial", label: "Luxury Commercial", icon: "💎", category: "Cinematic" },
  { value: "animated-mixed", label: "Animated / Mixed Media", icon: "🎨", category: "Fun & Playful" },
  { value: "tech-review", label: "Tech Review", icon: "💻", category: "Thematic / Niche" },
  { value: "fashion-lookbook", label: "Fashion Lookbook", icon: "👗", category: "Thematic / Niche" },
  { value: "retro-vhs", label: "Retro VHS", icon: "📼", category: "Visual Treatments" },
  { value: "monochrome", label: "Monochrome", icon: "⚫", category: "Visual Treatments" },
  { value: "neon-cyberpunk", label: "Neon Cyberpunk", icon: "🤖", category: "Visual Treatments" },
  { value: "film-grain", label: "Film Grain", icon: "🎞️", category: "Visual Treatments" },
];

const ENVIRONMENTS = [
  { value: "indoor-studio", label: "Indoor Studio", icon: "🏢" },
  { value: "outdoor-nature", label: "Outdoor Nature", icon: "🌳" },
  { value: "urban-cityscape", label: "Urban Cityscape", icon: "🏙️" },
  { value: "minimalist", label: "Minimalist", icon: "⬜" },
  { value: "luxury-opulent", label: "Luxury Opulent", icon: "💎" },
  { value: "vintage-retro", label: "Vintage Retro", icon: "📼" },
  { value: "futuristic-scifi", label: "Futuristic Sci-Fi", icon: "🚀" },
  { value: "beach-coastal", label: "Beach Coastal", icon: "🏖️" },
  { value: "mountain-landscape", label: "Mountain Landscape", icon: "⛰️" },
  { value: "home-cozy", label: "Home Cozy", icon: "🏠" },
];

export type AIBackgroundGenerateOpts =
  | { mode: "manual"; manual_prompt: string }
  | { mode: "env"; mood: string; style: string; environment: string };

function AIBackgroundModal({
  open,
  onClose,
  onGenerate,
  productDescription = "",
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (opts: AIBackgroundGenerateOpts) => void;
  productDescription?: string;
}) {
  const [generationMode, setGenerationMode] = useState<"manual" | "env">("env");
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [extractPromptLoading, setExtractPromptLoading] = useState(false);
  const [hasExtractedPromptOnce, setHasExtractedPromptOnce] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const canGenerate =
    generationMode === "manual"
      ? prompt.trim().length > 0
      : mood !== null && style !== null && environment !== null;

  const handleExtractPrompt = async () => {
    setExtractError(null);
    setExtractPromptLoading(true);
    try {
      const moodLabel = mood ? MOODS.find((m) => m.value === mood)?.label ?? mood : undefined;
      const styleLabel = style ? STYLES.find((s) => s.value === style)?.label ?? style : undefined;
      const envLabel = environment ? ENVIRONMENTS.find((e) => e.value === environment)?.label ?? environment : undefined;
      const res = await fetch(BACKGROUND_EXTRACT_PROMPT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product_description: (productDescription || "").trim() || "Product",
          mood: moodLabel,
          style: styleLabel,
          environment: envLabel,
        }),
      });
      const data = (await res.json()) as { success?: boolean; prompt?: string; error?: string | null };
      if (data.success === true && typeof data.prompt === "string") {
        setPrompt(data.prompt);
        setHasExtractedPromptOnce(true);
      } else {
        setExtractError(data.error ?? "Failed to extract prompt");
      }
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setExtractPromptLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!canGenerate) return;
    if (generationMode === "manual") {
      onGenerate({ mode: "manual", manual_prompt: prompt.trim() });
    } else {
      onGenerate({ mode: "env", mood: mood!, style: style!, environment: environment! });
    }
    onClose();
  };

  if (!open) return null;

  const cardBase = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
    borderRadius: "8px",
    background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
    overflow: "hidden",
  };
  const cardTitle = { margin: 0, padding: "6px 8px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--p-color-text-subdued, #6d7175)", borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)" };
  const listStyle = { flex: 1, overflowY: "auto" as const, padding: "4px", maxHeight: "240px" };

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
        padding: "12px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Generate background with AI</h3>
          <button type="button" onClick={onClose} style={{ padding: "4px", border: "none", background: "transparent", cursor: "pointer", fontSize: "18px", lineHeight: 1, color: "#5c5f62" }} aria-label="Close">×</button>
        </div>
        {/* Section 1: Manual prompt */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            opacity: generationMode === "manual" ? 1 : 0.6,
            transition: "opacity 0.2s ease",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
            <input
              type="radio"
              name="ai-bg-mode"
              checked={generationMode === "manual"}
              onChange={() => setGenerationMode("manual")}
              style={{ width: "14px", height: "14px", accentColor: "var(--p-color-bg-fill-info, #2c6ecb)" }}
            />
            <span>Manual prompt</span>
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              pointerEvents: generationMode === "manual" ? "auto" : "none",
            }}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the background (or use Generate to suggest from product)"
              rows={2}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                fontSize: "12px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={handleExtractPrompt}
              disabled={extractPromptLoading}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                background: extractPromptLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                color: "#fff",
                fontWeight: 600,
                cursor: extractPromptLoading ? "wait" : "pointer",
                fontSize: "12px",
                flexShrink: 0,
              }}
            >
              {extractPromptLoading ? "…" : hasExtractedPromptOnce ? "Regenerate Prompt" : "Generate Prompt"}
            </button>
          </div>
          {extractError && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--p-color-text-critical, #d72c0d)" }}>{extractError}</p>
          )}
        </div>
        {/* Section 2: Mood, style & environment */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "10px 12px",
            flex: "1 1 auto",
            minHeight: 0,
            opacity: generationMode === "env" ? 1 : 0.6,
            transition: "opacity 0.2s ease",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
            <input
              type="radio"
              name="ai-bg-mode"
              checked={generationMode === "env"}
              onChange={() => setGenerationMode("env")}
              style={{ width: "14px", height: "14px", accentColor: "var(--p-color-bg-fill-info, #2c6ecb)" }}
            />
            <span>Mood, style & environment</span>
          </label>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flex: "1 1 auto",
              minHeight: 0,
              pointerEvents: generationMode === "env" ? "auto" : "none",
            }}
          >
            <div style={cardBase}>
              <p style={cardTitle}>Mood</p>
              <div style={listStyle}>
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      width: "100%",
                      padding: "6px 8px",
                      marginBottom: "2px",
                      border: "none",
                      borderRadius: "6px",
                      background: mood === m.value ? "rgba(44, 110, 203, 0.2)" : "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={cardBase}>
              <p style={cardTitle}>Style</p>
              <div style={listStyle}>
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      width: "100%",
                      padding: "6px 8px",
                      marginBottom: "2px",
                      border: "none",
                      borderRadius: "6px",
                      background: style === s.value ? "rgba(44, 110, 203, 0.2)" : "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={cardBase}>
              <p style={cardTitle}>Environment</p>
              <div style={listStyle}>
                {ENVIRONMENTS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setEnvironment(e.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      width: "100%",
                      padding: "6px 8px",
                      marginBottom: "2px",
                      border: "none",
                      borderRadius: "6px",
                      background: environment === e.value ? "rgba(44, 110, 203, 0.2)" : "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    <span>{e.icon}</span>
                    <span>{e.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button type="button" onClick={onClose} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--p-color-border-secondary, #e1e3e5)", background: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Cancel</button>
          <button type="button" onClick={handleGenerate} disabled={!canGenerate} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: canGenerate ? "var(--p-color-bg-fill-info, #2c6ecb)" : "#ccc", color: "#fff", fontWeight: 600, cursor: canGenerate ? "pointer" : "not-allowed", fontSize: "12px" }}>Generate</button>
        </div>
      </div>
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
  const lastLoadRef = useRef<{ query: string; page: number } | null>(null);

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
    if (lastLoadRef.current?.query === q && lastLoadRef.current?.page === page) return;
    lastLoadRef.current = { query: q, page };
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

  useEffect(() => {
    if (!open) lastLoadRef.current = null;
  }, [open]);

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

/** Track as shown in the picker list (has duration_seconds for building save payload; genre for local tracks) */
type BgMusicPickerTrack = { id: string; title: string; preview_url: string | null; duration_seconds: number | null; genre?: string };

function StoryblocksMusicModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (track: { id: string; name: string; genre: string; duration: number | null; previewUrl: string | null; downloadUrl: string | null }) => void;
}) {
  const [musicSource, setMusicSource] = useState<"local" | "storyblocks">("local");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pickedTrack, setPickedTrack] = useState<BgMusicPickerTrack | null>(null);

  const localFetcher = useFetcher<{
    success: boolean;
    tracks: Array<{ id: string; title: string; genre: string; preview_url: string; duration_seconds: number | null }>;
    error?: string;
  }>();
  const fetcher = useFetcher<{
    success: boolean;
    tracks: Array<{ id: string; title: string; preview_url: string | null; duration_seconds: number | null; bpm: number | null; thumbnail_url: string | null }>;
    total: number;
    page: number;
    per_page: number;
    error?: string;
  }>();
  const lastLoadRef = useRef<{ query: string; page: number } | null>(null);

  const isLoading = fetcher.state === "loading";
  const data = fetcher.data;
  const storyblocksTracks = data?.success ? data.tracks : [];
  const apiError = data && !data.success && "error" in data ? (data as { error?: string }).error : null;
  const perPage = 12;

  const localData = localFetcher.data;
  const localTracksRaw = localData?.success ? localData.tracks : [];
  const genres = Array.from(new Set(localTracksRaw.map((t) => t.genre))).sort();
  const localTracks = genreFilter ? localTracksRaw.filter((t) => t.genre === genreFilter) : localTracksRaw;
  const localError = localData && !localData.success && "error" in localData ? (localData as { error?: string }).error : null;

  const loadPage = (page: number) => {
    const q = query.trim() || "upbeat";
    if (lastLoadRef.current?.query === q && lastLoadRef.current?.page === page) return;
    lastLoadRef.current = { query: q, page };
    fetcher.load(
      `${STORYBLOCKS_MUSIC_API}?${new URLSearchParams({ query: q, page: String(page), per_page: String(perPage) }).toString()}`
    );
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setPickedTrack(null);
    loadPage(1);
  };

  const handleUseTrack = () => {
    if (pickedTrack) {
      onSelect({
        id: pickedTrack.id,
        name: pickedTrack.title,
        genre: pickedTrack.genre ?? "Storyblocks",
        duration: pickedTrack.duration_seconds != null ? Math.round(pickedTrack.duration_seconds) : null,
        previewUrl: pickedTrack.preview_url ?? null,
        downloadUrl: pickedTrack.preview_url ?? null,
      });
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      lastLoadRef.current = null;
      setPickedTrack(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && musicSource === "local" && !localData) {
      localFetcher.load(LOCAL_MUSIC_API);
    }
  }, [open, musicSource, localData]);

  if (!open) return null;

  const isLocal = musicSource === "local";
  const showLocalGrid = isLocal;
  const showStoryblocksUI = !isLocal;

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
          maxWidth: "640px",
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
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Select background music</h3>
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

        {/* Tabs: Local library | Storyblocks */}
        <div style={{ padding: "0 20px", borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)", display: "flex", gap: "0" }}>
          <button
            type="button"
            onClick={() => { setMusicSource("local"); setPickedTrack(null); }}
            style={{
              padding: "12px 16px",
              border: "none",
              borderBottom: musicSource === "local" ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              color: musicSource === "local" ? "var(--p-color-text-primary, #202223)" : "var(--p-color-text-subdued, #6d7175)",
            }}
          >
            Local library
          </button>
          <button
            type="button"
            onClick={() => { setMusicSource("storyblocks"); setPickedTrack(null); }}
            style={{
              padding: "12px 16px",
              border: "none",
              borderBottom: musicSource === "storyblocks" ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              color: musicSource === "storyblocks" ? "var(--p-color-text-primary, #202223)" : "var(--p-color-text-subdued, #6d7175)",
            }}
          >
            Storyblocks
          </button>
        </div>

        {showStoryblocksUI && (
          <div style={{ padding: "12px 20px", display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
              placeholder="e.g. upbeat corporate"
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
              disabled={isLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: isLoading ? "#9ca3af" : "var(--p-color-bg-fill-secondary, #5c5f62)",
                color: "#fff",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
          </div>
        )}

        {showLocalGrid && genres.length > 0 && (
          <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)", whiteSpace: "nowrap" }}>Genre:</label>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                fontSize: "14px",
                minWidth: "140px",
              }}
            >
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <span style={{ fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)" }}>{localTracks.length} track{localTracks.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {(apiError || localError) && (
          <div style={{ padding: "8px 20px", fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>
            {showLocalGrid ? localError : apiError}
          </div>
        )}

        <div
          style={{
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "12px",
            overflow: "auto",
            minHeight: "200px",
          }}
        >
          {showLocalGrid && (
            <>
              {localFetcher.state === "loading" && localTracks.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
                  Loading…
                </div>
              )}
              {showLocalGrid && localFetcher.state !== "loading" && localTracks.length === 0 && localData !== undefined && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
                  {genreFilter ? "No tracks in this genre." : "No local tracks found."}
                </div>
              )}
              {showLocalGrid && localTracks.map((track) => {
                const isSelected = pickedTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPickedTrack({ id: track.id, title: track.title, preview_url: track.preview_url, duration_seconds: track.duration_seconds, genre: track.genre })}
                    onKeyDown={(e) => e.key === "Enter" && setPickedTrack({ id: track.id, title: track.title, preview_url: track.preview_url, duration_seconds: track.duration_seconds, genre: track.genre })}
                    style={{
                      borderRadius: "10px",
                      border: isSelected ? "2px solid var(--p-color-border-info, #2c6ecb)" : "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: isSelected ? "var(--p-color-bg-fill-info-secondary, #e8f4fc)" : "#fff",
                      padding: "12px",
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: "8px", background: "var(--p-color-bg-surface-secondary, #e1e3e5)", marginBottom: "8px", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d7175", fontSize: "24px" }}>♪</div>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--p-color-text-primary, #202223)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={track.title}>
                      {track.title}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--p-color-text-subdued, #6d7175)" }}>{track.genre}</p>
                    {track.preview_url ? (
                      <>
                        <p style={{ margin: "8px 0 4px", fontSize: "11px", fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>Listen</p>
                        <audio src={track.preview_url} controls style={{ width: "100%", marginTop: "0", height: "32px" }} onClick={(e) => e.stopPropagation()} />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}

          {showStoryblocksUI && (
            <>
              {isLoading && storyblocksTracks.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
                  Searching…
                </div>
              )}
              {showStoryblocksUI && !isLoading && storyblocksTracks.length === 0 && data !== undefined && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "var(--p-color-text-subdued, #6d7175)" }}>
                  No tracks found. Try another search.
                </div>
              )}
              {showStoryblocksUI && storyblocksTracks.map((track) => {
                const isSelected = pickedTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPickedTrack({ id: track.id, title: track.title, preview_url: track.preview_url, duration_seconds: track.duration_seconds })}
                    onKeyDown={(e) => e.key === "Enter" && setPickedTrack({ id: track.id, title: track.title, preview_url: track.preview_url, duration_seconds: track.duration_seconds })}
                    style={{
                      borderRadius: "10px",
                      border: isSelected ? "2px solid var(--p-color-border-info, #2c6ecb)" : "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: isSelected ? "var(--p-color-bg-fill-info-secondary, #e8f4fc)" : "#fff",
                      padding: "12px",
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: "8px", background: "var(--p-color-bg-surface-secondary, #e1e3e5)", marginBottom: "8px", overflow: "hidden" }}>
                      {track.thumbnail_url ? (
                        <img src={track.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d7175", fontSize: "24px" }}>♪</div>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--p-color-text-primary, #202223)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={track.title}>
                      {track.title}
                    </p>
                    {track.duration_seconds != null && (
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--p-color-text-subdued, #6d7175)" }}>{Math.round(track.duration_seconds)}s</p>
                    )}
                    {track.preview_url ? (
                      <>
                        <p style={{ margin: "8px 0 4px", fontSize: "11px", fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>Listen</p>
                        <audio src={track.preview_url} controls style={{ width: "100%", marginTop: "0", height: "32px" }} onClick={(e) => e.stopPropagation()} />
                      </>
                    ) : (
                      <p style={{ margin: "8px 0 0", fontSize: "11px", color: "var(--p-color-text-subdued, #6d7175)", fontStyle: "italic" }}>Preview not available</p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {showStoryblocksUI && data?.success && (data.total > 0 || storyblocksTracks.length > 0) && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Page {data.page ?? currentPage} of {Math.max(1, Math.ceil((data.total ?? 0) / perPage))}
              {data.total != null && data.total > 0 && ` · ${data.total} track${data.total === 1 ? "" : "s"} total`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={isLoading || (data?.page ?? currentPage) <= 1}
                onClick={() => {
                  const prev = Math.max(1, (data?.page ?? currentPage) - 1);
                  setCurrentPage(prev);
                  loadPage(prev);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: (data?.page ?? currentPage) <= 1 ? "not-allowed" : "pointer",
                  color: (data?.page ?? currentPage) <= 1 ? "#9ca3af" : "var(--p-color-text-primary, #202223)",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={isLoading || (data?.page ?? currentPage) >= Math.ceil((data?.total ?? 0) / perPage)}
                onClick={() => {
                  const next = (data?.page ?? currentPage) + 1;
                  setCurrentPage(next);
                  loadPage(next);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  background: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: (data?.page ?? currentPage) >= Math.ceil((data?.total ?? 0) / perPage) ? "not-allowed" : "pointer",
                  color: (data?.page ?? currentPage) >= Math.ceil((data?.total ?? 0) / perPage) ? "#9ca3af" : "var(--p-color-text-primary, #202223)",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {pickedTrack && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)", marginRight: "auto" }}>{pickedTrack.title || "Selected track"}</span>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--p-color-border-secondary, #e1e3e5)", background: "#fff", cursor: "pointer", fontSize: "14px" }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUseTrack}
              style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "var(--p-color-bg-fill-info, #2c6ecb)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "14px" }}
            >
              Use this track
            </button>
          </div>
        )}
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
  const lastLoadRef = useRef<{ query: string; page: number } | null>(null);

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
    if (lastLoadRef.current?.query === q && lastLoadRef.current?.page === page) return;
    lastLoadRef.current = { query: q, page };
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
    // Prefer download_url (actual video file) for merge; fall back to preview_url for display-only sources
    const url = item.download_url || item.preview_url;
    if (url) {
      onSelect(url);
      onClose();
    }
  };

  useEffect(() => {
    if (!open) lastLoadRef.current = null;
  }, [open]);

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

type AudioInfoSnapshot = {
  voiceId: string | null;
  voiceName: string | null;
  audioScript: string | null;
  generatedAudioUrl: string | null;
  subtitles: unknown;
} | null;

type BgMusicSnapshot = {
  id: string | null;
  name: string | null;
  genre?: string | null;
  duration?: number | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
};

type ShortInfo = {
  shortId: string | null;
  userId: string | null;
  scene1Id: string | null;
  scene2Id: string | null;
  scene3Id: string | null;
  scene1GeneratedVideoUrl: string | null;
  scene2GeneratedVideoUrl: string | null;
  scene3GeneratedVideoUrl: string | null;
  audioInfo: AudioInfoSnapshot;
  bgMusic: BgMusicSnapshot | null;
  finalVideoUrl: string | null;
};

export type WorkflowProduct = { name: string; price?: string; rating?: number; description?: string };

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
  const shopify = useAppBridge();
  const productImages = productImagesProp?.length ? productImagesProp : defaultProductImages;
  const firstImageId = productImages[0]?.id ?? "s1";
  const showSkipRemoveBgWarning = () => shopify.toast.show(SKIP_REMOVE_BG_WARNING);

  const loadTempFetcher = useFetcher<{ state: WorkflowTempState | null }>();
  const loadShortFetcher = useFetcher<ShortInfo>();
  const saveTempFetcher = useFetcher();
  const deleteTempFetcher = useFetcher();
  const voicesFetcher = useFetcher<{ success: boolean; voices: Array<{ voice_id: string; name: string; preview_url?: string }>; error?: string }>();
  const audioConfigFetcher = useFetcher<{ backendUrl: string }>();
  const shortInfo: ShortInfo | null =
    loadShortFetcher.data != null
      ? {
          shortId: loadShortFetcher.data.shortId ?? null,
          userId: loadShortFetcher.data.userId ?? null,
          scene1Id: loadShortFetcher.data.scene1Id ?? null,
          scene2Id: loadShortFetcher.data.scene2Id ?? null,
          scene3Id: loadShortFetcher.data.scene3Id ?? null,
          scene1GeneratedVideoUrl: (loadShortFetcher.data as { scene1GeneratedVideoUrl?: string | null }).scene1GeneratedVideoUrl ?? null,
          scene2GeneratedVideoUrl: (loadShortFetcher.data as { scene2GeneratedVideoUrl?: string | null }).scene2GeneratedVideoUrl ?? null,
          scene3GeneratedVideoUrl: (loadShortFetcher.data as { scene3GeneratedVideoUrl?: string | null }).scene3GeneratedVideoUrl ?? null,
          audioInfo: (loadShortFetcher.data as { audioInfo?: AudioInfoSnapshot }).audioInfo ?? null,
          bgMusic: (loadShortFetcher.data as { bgMusic?: BgMusicSnapshot | null }).bgMusic ?? null,
          finalVideoUrl: (loadShortFetcher.data as { finalVideoUrl?: string | null }).finalVideoUrl ?? null,
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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [audioScript, setAudioScript] = useState<string>("");
  const [scriptGenerateLoading, setScriptGenerateLoading] = useState(false);
  const [scriptSaveLoading, setScriptSaveLoading] = useState(false);
  const [audioGenerateLoading, setAudioGenerateLoading] = useState(false);
  const [audioSaveLoading, setAudioSaveLoading] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [lastSubtitleTiming, setLastSubtitleTiming] = useState<Array<{ text: string; start_time: number; end_time: number; duration: number }> | null>(null);
  const [scriptSavedFeedback, setScriptSavedFeedback] = useState(false);
  const [audioSavedFeedback, setAudioSavedFeedback] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string>("");
  const [audioStepTab, setAudioStepTab] = useState<"voiceover" | "bgMusic">("voiceover");
  const [selectedBgMusic, setSelectedBgMusic] = useState<BgMusicSnapshot | null>(null);
  const [bgMusicSaveLoading, setBgMusicSaveLoading] = useState(false);
  const [bgMusicSavedFeedback, setBgMusicSavedFeedback] = useState(false);
  const [bgMusicModalOpen, setBgMusicModalOpen] = useState(false);
  const initedAudioFromInfoRef = useRef(false);
  const voicesLoadStartedRef = useRef(false);

  const [scene1Snapshot, setScene1Snapshot] = useState<WorkflowTempState["scene1"] | null>(null);
  const [scene2Snapshot, setScene2Snapshot] = useState<WorkflowTempState["scene2"] | null>(null);
  const [scene3Snapshot, setScene3Snapshot] = useState<WorkflowTempState["scene3"] | null>(null);
  const [scene1ResetKey, setScene1ResetKey] = useState(0);
  const [scene2ResetKey, setScene2ResetKey] = useState(0);
  const [scene3ResetKey, setScene3ResetKey] = useState(0);
  const [scene1Regenerated, setScene1Regenerated] = useState(false);
  const [scene2Regenerated, setScene2Regenerated] = useState(false);
  const [scene3Regenerated, setScene3Regenerated] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeProgress, setFinalizeProgress] = useState<number | null>(null);
  /** Final video URL from merge (set after finalize completes; used when showing final view) */
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const allScenesComplete = scene1Complete && scene2Complete && scene3Complete;

  /** Resolved final video URL: from merge result or from short (e.g. after reload) */
  const displayedFinalVideoUrl = finalVideoUrl ?? shortInfo?.finalVideoUrl ?? null;

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

  // Reset audio init ref when short changes (e.g. different product)
  useEffect(() => {
    initedAudioFromInfoRef.current = false;
  }, [shortInfo?.shortId]);

  // Init audio state from saved AudioInfo once when short loads (so we don't overwrite user edits)
  useEffect(() => {
    const info = shortInfo?.audioInfo;
    if (!info || initedAudioFromInfoRef.current) return;
    initedAudioFromInfoRef.current = true;
    if (typeof info.audioScript === "string" && info.audioScript) {
      setAudioScript(info.audioScript);
      setScriptGenerated(true);
    }
    if (typeof info.voiceId === "string" && info.voiceId) {
      setSelectedVoiceId(info.voiceId);
    }
    if (typeof info.generatedAudioUrl === "string" && info.generatedAudioUrl) {
      setGeneratedAudioUrl(info.generatedAudioUrl);
      setAudioGenerated(true);
    }
    if (info.subtitles && Array.isArray(info.subtitles)) {
      setLastSubtitleTiming(info.subtitles as Array<{ text: string; start_time: number; end_time: number; duration: number }>);
    }
  }, [shortInfo?.audioInfo]);

  // Init selected bg music from short when loaded
  useEffect(() => {
    const saved = shortInfo?.bgMusic;
    if (saved && (saved.id || saved.previewUrl || (saved as { preview_url?: string }).preview_url)) {
      const p = saved as { id?: string | null; name?: string | null; title?: string | null; genre?: string | null; duration?: number | null; previewUrl?: string | null; preview_url?: string | null; downloadUrl?: string | null };
      setSelectedBgMusic({
        id: p.id ?? null,
        name: p.name ?? p.title ?? null,
        genre: p.genre ?? "Storyblocks",
        duration: typeof p.duration === "number" ? p.duration : null,
        previewUrl: p.previewUrl ?? p.preview_url ?? null,
        downloadUrl: p.downloadUrl ?? p.previewUrl ?? p.preview_url ?? null,
      });
    }
  }, [shortInfo?.shortId, shortInfo?.bgMusic?.id, shortInfo?.bgMusic?.previewUrl, shortInfo?.bgMusic?.name]);

  // Load voices and backend config once when audio step becomes relevant (avoid re-fetch loop)
  useEffect(() => {
    if (!allScenesComplete) return;
    if (!voicesLoadStartedRef.current) {
      voicesLoadStartedRef.current = true;
      voicesFetcher.load(AUDIO_VOICES_API);
    }
    if (audioConfigFetcher.state === "idle" && !audioConfigFetcher.data) {
      audioConfigFetcher.load(AUDIO_CONFIG_API);
    }
  }, [allScenesComplete, audioConfigFetcher.state, audioConfigFetcher.data]);

  useEffect(() => {
    if (audioConfigFetcher.data?.backendUrl) {
      setBackendUrl(audioConfigFetcher.data.backendUrl);
    }
  }, [audioConfigFetcher.data]);

  // Default to first voice when list loads and none selected
  useEffect(() => {
    const voices = voicesFetcher.data?.success ? voicesFetcher.data.voices : [];
    if (voices.length > 0 && !selectedVoiceId) {
      setSelectedVoiceId(voices[0].voice_id);
    }
  }, [voicesFetcher.data, selectedVoiceId]);

  // Restore workflow state from temp only on initial load (when still "pending").
  // This prevents revalidation from overwriting state the user just set (e.g. after generating script).
  useEffect(() => {
    if (loadedState !== "pending" || loadTempFetcher.state !== "idle" || !loadTempFetcher.data) return;
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
  }, [loadedState, loadTempFetcher.state, loadTempFetcher.data]);

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

  const handleFinalize = async () => {
    if (!shortInfo?.shortId) {
      setFinalizeError("Short not loaded. Please close and reopen the workflow.");
      return;
    }
    if (displayedFinalVideoUrl) {
      setShowingFinal(true);
      return;
    }
    setFinalizeError(null);
    setFinalizeLoading(true);
    setFinalizeProgress(0);
    const shortId = shortInfo.shortId;
    console.log("[Finalize] Starting short_id=", shortId);
    try {
      const startRes = await fetch(MERGE_FINALIZE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ short_id: shortId }),
      });
      const startData = await startRes.json().catch(() => ({}));
      const taskId = startData.task_id;
      if (!taskId) {
        console.log("[Finalize] Start failed short_id=", shortId, "error=", startData.error);
        setFinalizeError(startData.error ?? "Failed to start finalize");
        return;
      }
      console.log("[Finalize] Started task_id=", taskId, "short_id=", shortId);
      let done = false;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const pollRes = await fetch(`${MERGE_STATUS_API_BASE}/${encodeURIComponent(taskId)}`, {
          credentials: "include",
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const statusData = await pollRes.json().catch(() => ({}));
        const progress = typeof statusData.progress === "number" ? statusData.progress : null;
        setFinalizeProgress(progress);
        if (i % 6 === 0 || statusData.status === "completed" || statusData.status === "failed") {
          console.log("[Finalize] poll attempt=", i + 1, "task_id=", taskId, "status=", statusData.status, "progress=", progress);
        }
        if (statusData.status === "completed" && statusData.final_video_url) {
          const url = statusData.final_video_url;
          console.log("[Finalize] completed task_id=", taskId, "final_video_url=", url?.slice(0, 80), "...");
          setFinalVideoUrl(url);
          try {
            await fetch(SHORTS_SAVE_FINAL_VIDEO_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ short_id: shortId, final_video_url: url }),
            });
            console.log("[Finalize] saved final_video_url to short_id=", shortId);
          } catch (e) {
            console.error("[Finalize] Failed to save final video URL:", e);
          }
          setShowingFinal(true);
          done = true;
          break;
        }
        if (statusData.status === "failed") {
          const errMsg = statusData.error_message ?? "Finalize failed";
          console.log("[Finalize] failed task_id=", taskId, "error_message=", errMsg);
          setFinalizeError(errMsg);
          done = true;
          break;
        }
      }
      if (!done) {
        console.log("[Finalize] timeout task_id=", taskId, "after", POLL_MAX_ATTEMPTS, "attempts");
        setFinalizeError("Finalize timed out. Please try again.");
      }
    } catch (e) {
      console.error("[Finalize] exception short_id=", shortId, e);
      setFinalizeError(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setFinalizeLoading(false);
      setFinalizeProgress(null);
    }
  };

  const handleRegenerateScene1 = async () => {
    if (shortInfo?.scene1Id) {
      try {
        await fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: shortInfo.scene1Id, reset: true }),
        });
      } catch {
        // continue with UI reset
      }
    }
    setScene1Complete(false);
    setScene1Snapshot(null);
    setScene1ResetKey((k) => k + 1);
    setScene1Regenerated(true);
    if (productId?.trim()) {
      loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId.trim())}`);
    }
  };
  const handleRegenerateScene2 = async () => {
    if (shortInfo?.scene2Id) {
      try {
        await fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: shortInfo.scene2Id, reset: true }),
        });
      } catch {
        // continue with UI reset
      }
    }
    setScene2Complete(false);
    setScene2Snapshot(null);
    setScene2ResetKey((k) => k + 1);
    setScene2Regenerated(true);
    if (productId?.trim()) {
      loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId.trim())}`);
    }
  };
  const handleRegenerateScene3 = async () => {
    if (shortInfo?.scene3Id) {
      try {
        await fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: shortInfo.scene3Id, reset: true }),
        });
      } catch {
        // continue with UI reset
      }
    }
    setScene3Complete(false);
    setScene3Snapshot(null);
    setScene3ResetKey((k) => k + 1);
    setScene3Regenerated(true);
    if (productId?.trim()) {
      loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId.trim())}`);
    }
  };

  const handleStartFromScratch = async () => {
    if (shortInfo?.shortId) {
      try {
        await fetch(SHORTS_RESET_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ shortId: shortInfo.shortId }),
        });
      } catch {
        // continue with UI reset
      }
      if (productId?.trim()) {
        loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId.trim())}`);
      }
    }
    setShowingFinal(false);
    setScene1Complete(false);
    setScene2Complete(false);
    setScene3Complete(false);
    setScene1Snapshot(null);
    setScene2Snapshot(null);
    setScene3Snapshot(null);
    setScriptGenerated(false);
    setAudioGenerated(false);
    setScene1Regenerated(true);
    setScene2Regenerated(true);
    setScene3Regenerated(true);
    setScene1ResetKey((k) => k + 1);
    setScene2ResetKey((k) => k + 1);
    setScene3ResetKey((k) => k + 1);
    setActiveTab("scene1");
    setFinalVideoUrl(null);
    if (productId?.trim()) {
      deleteTempFetcher.submit(null, {
        method: "delete",
        action: `${WORKFLOW_TEMP_API}?productId=${encodeURIComponent(productId.trim())}`,
      });
    }
  };

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
            {displayedFinalVideoUrl ? (
              <>
                <video
                  src={displayedFinalVideoUrl}
                  controls
                  style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: "12px", border: "1px solid #e1e3e5" }}
                />
                <button
                  type="button"
                  onClick={handleStartFromScratch}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--p-color-text-primary, #202223)",
                  }}
                >
                  Start from scratch
                </button>
              </>
            ) : (
              <>
                <p style={{ color: "var(--p-color-text-subdued, #6d7175)", margin: 0 }}>No final video yet. Go back and click Finalize to merge all scenes.</p>
                <button
                  type="button"
                  onClick={() => setShowingFinal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Back
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                if (productId?.trim()) {
                  deleteTempFetcher.submit(null, {
                    method: "delete",
                    action: `${WORKFLOW_TEMP_API}?productId=${encodeURIComponent(productId.trim())}`,
                  });
                }
                if (displayedFinalVideoUrl) onDone?.(displayedFinalVideoUrl);
                onClose();
              }}
              disabled={!displayedFinalVideoUrl}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: displayedFinalVideoUrl ? "var(--p-color-bg-fill-info, #2c6ecb)" : "#9ca3af",
                color: "#fff",
                fontWeight: 600,
                cursor: displayedFinalVideoUrl ? "pointer" : "not-allowed",
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
            {/* Stepper: Scene 1 → Scene 2 → Scene 3 → Audio → Final (visual only) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                padding: "12px 20px",
                borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
              }}
            >
              {[
                { key: "scene1", label: "Scene 1", done: scene1Complete, active: !allScenesComplete && activeTab === "scene1" },
                { key: "scene2", label: "Scene 2", done: scene2Complete, active: !allScenesComplete && activeTab === "scene2" },
                { key: "scene3", label: "Scene 3", done: scene3Complete, active: !allScenesComplete && activeTab === "scene3" },
                { key: "audio", label: "Audio", done: false, active: allScenesComplete },
                { key: "final", label: "Final", done: false, active: false },
              ].map((item, index) => (
                <div key={item.key} style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: item.active ? "var(--p-color-bg-fill-info, #2c6ecb)" : item.done ? "var(--p-color-bg-fill-success-secondary, #d3f0d9)" : "transparent",
                      color: item.active ? "#fff" : item.done ? "var(--p-color-text-success, #008060)" : "var(--p-color-text-subdued, #6d7175)",
                      border: item.active || item.done ? "none" : "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    }}
                  >
                    {item.done ? "✓ " : ""}{item.label}
                  </span>
                  {index < 4 && (
                    <span
                      style={{
                        width: "20px",
                        height: "2px",
                        margin: "0 2px",
                        background: item.done ? "var(--p-color-border-success, #008060)" : "var(--p-color-border-secondary, #e1e3e5)",
                      }}
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
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
                      gap: "8px",
                    }}
                  >
                    {complete ? (
                      <span style={{ color: "var(--p-color-text-success, #008060)", fontSize: "16px" }} title="Complete" aria-hidden>✓</span>
                    ) : null}
                    {label}
                  </button>
                );
              })}
            </div>

            {allScenesComplete && (
              <div
                style={{
                  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: "45vh",
                  minHeight: "280px",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", borderBottom: "2px solid var(--p-color-border-secondary, #e1e3e5)", flexShrink: 0 }}>
                  {(["voiceover", "bgMusic"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setAudioStepTab(tab)}
                      style={{
                        flex: 1,
                        padding: "14px 20px",
                        border: "none",
                        background: audioStepTab === tab ? "#fff" : "transparent",
                        color: audioStepTab === tab ? "var(--p-color-text-primary, #202223)" : "var(--p-color-text-subdued, #6d7175)",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        borderBottom: audioStepTab === tab ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid transparent",
                        marginBottom: -2,
                      }}
                    >
                      {tab === "voiceover" ? "Voiceover" : "Background music"}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "20px", flex: 1, minHeight: 0, overflowY: "auto" }}>
                  {audioStepTab === "voiceover" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)" }}>Generate a voiceover from script (optional).</p>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap", width: "100%" }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                          <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)", fontWeight: 600 }}>Voice</label>
                          <select
                            value={selectedVoiceId}
                            onChange={(e) => setSelectedVoiceId(e.target.value)}
                            disabled={!voicesFetcher.data?.success}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                              fontSize: "14px",
                              background: "#fff",
                              boxSizing: "border-box",
                            }}
                          >
                            {voicesFetcher.state === "loading" && <option value="">Loading voices…</option>}
                            {voicesFetcher.data?.success && voicesFetcher.data.voices.length === 0 && <option value="">No voices (check ELEVENLABS_API_KEY)</option>}
                            {voicesFetcher.data?.success && voicesFetcher.data.voices.map((v) => (
                              <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                        {!scriptGenerated && (
                          <button
                            type="button"
                            disabled={!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || scriptGenerateLoading}
                            onClick={async () => {
                              if (!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId) return;
                              setScriptGenerateLoading(true);
                              try {
                                const res = await fetch(AUDIO_GENERATE_SCRIPT_API, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                  voice_id: selectedVoiceId,
                                  user_id: shortInfo.userId,
                                  short_id: shortInfo.shortId,
                                  product_description: (typeof product?.description === "string" && product.description.trim())
                                    ? product.description.trim()
                                    : (typeof product?.name === "string" && product.name.trim())
                                      ? product.name.trim()
                                      : undefined,
                                }),
                                });
                                const data = await res.json();
                                const scriptText = typeof data.script === "string" ? data.script : "";
                                if (scriptText) { setAudioScript(scriptText); setScriptGenerated(true); } else { alert(data.error || "Failed to generate script"); }
                              } finally { setScriptGenerateLoading(false); }
                            }}
                            style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: scriptGenerateLoading || !selectedVoiceId ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)", color: "#fff", fontWeight: 600, cursor: scriptGenerateLoading || !selectedVoiceId ? "not-allowed" : "pointer", fontSize: "14px" }}
                          >
                            {scriptGenerateLoading ? "Generating…" : "Generate audio script"}
                          </button>
                        )}
                      </div>
                      {scriptGenerated && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 280px", minWidth: "200px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                              <label style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)", fontWeight: 600 }}>Script (edit if needed)</label>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <button
                                  type="button"
                                  disabled={!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || scriptGenerateLoading}
                                  onClick={async () => {
                                    if (!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId) return;
                                    setScriptGenerateLoading(true);
                                    try {
                                      const res = await fetch(AUDIO_GENERATE_SCRIPT_API, {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          voice_id: selectedVoiceId,
                                          user_id: shortInfo.userId,
                                          short_id: shortInfo.shortId,
                                          product_description: (typeof product?.description === "string" && product.description.trim())
                                            ? product.description.trim()
                                            : (typeof product?.name === "string" && product.name.trim())
                                              ? product.name.trim()
                                              : undefined,
                                        }),
                                      });
                                      const data = await res.json();
                                      const scriptText = typeof data.script === "string" ? data.script : "";
                                      if (scriptText) { setAudioScript(scriptText); setScriptGenerated(true); } else { alert(data.error || "Failed to regenerate script"); }
                                    } finally { setScriptGenerateLoading(false); }
                                  }}
                                  title={scriptGenerateLoading ? "Regenerating…" : "Regenerate script"}
                                  style={{
                                    padding: "6px 10px",
                                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                                    borderRadius: "6px",
                                    background: scriptGenerateLoading ? "#9ca3af" : "#fff",
                                    color: "var(--p-color-text-primary, #202223)",
                                    cursor: scriptGenerateLoading || !selectedVoiceId ? "not-allowed" : "pointer",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {scriptGenerateLoading ? "Regenerating…" : "Regenerate script"}
                                </button>
                                <button
                                  type="button"
                                  disabled={!shortInfo?.shortId || scriptSaveLoading}
                                  onClick={async () => {
                                    if (!shortInfo?.shortId) return;
                                    setScriptSaveLoading(true); setScriptSavedFeedback(false);
                                    try {
                                      const res = await fetch(AUDIO_SAVE_SCRIPT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ short_id: shortInfo.shortId, audio_script: audioScript, voice_id: selectedVoiceId || undefined, voice_name: voicesFetcher.data?.success ? voicesFetcher.data.voices.find((v) => v.voice_id === selectedVoiceId)?.name : undefined }) });
                                      const data = await res.json();
                                      if (data.success) { setScriptSavedFeedback(true); setTimeout(() => setScriptSavedFeedback(false), 2000); } else { alert(data.error || "Failed to save script"); }
                                    } finally { setScriptSaveLoading(false); }
                                }}
                                  title={scriptSaveLoading ? "Saving…" : "Save script"}
                                  style={{
                                    padding: "6px 8px",
                                    border: "none",
                                    borderRadius: "6px",
                                    background: scriptSaveLoading ? "#9ca3af" : "var(--p-color-bg-fill-secondary, #5c5f62)",
                                    color: "#fff",
                                    cursor: scriptSaveLoading ? "wait" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={audioScript}
                              onChange={(e) => setAudioScript(e.target.value)}
                              rows={4}
                              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--p-color-border-secondary, #e1e3e5)", fontSize: "14px", lineHeight: 1.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                            {scriptSavedFeedback && <span style={{ display: "block", marginTop: "6px", fontSize: "13px", color: "var(--p-color-text-success, #008060)" }}>Saved</span>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", flex: "1 1 260px", minWidth: "200px" }}>
                            {!audioGenerated ? (
                              <button
                                type="button"
                                disabled={!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || !audioScript.trim() || audioGenerateLoading}
                                onClick={async () => {
                                  if (!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || !audioScript.trim()) return;
                                  setAudioGenerateLoading(true);
                                  try {
                                    const res = await fetch(AUDIO_GENERATE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_id: selectedVoiceId, user_id: shortInfo.userId, short_id: shortInfo.shortId, script: audioScript.trim() }) });
                                    const data = await res.json();
                                    if (data.audio_url) { setGeneratedAudioUrl(data.audio_url); setLastSubtitleTiming(Array.isArray(data.subtitle_timing) ? data.subtitle_timing : null); setAudioGenerated(true); } else { alert(data.error || "Failed to generate audio"); }
                                  } finally { setAudioGenerateLoading(false); }
                                }}
                                style={{ padding: "12px 24px", borderRadius: "8px", border: "none", background: audioGenerateLoading || !audioScript.trim() ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)", color: "#fff", fontWeight: 600, cursor: audioGenerateLoading || !audioScript.trim() ? "not-allowed" : "pointer", fontSize: "14px" }}
                              >
                                {audioGenerateLoading ? "Generating audio…" : "Generate audio"}
                              </button>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                  <audio src={(shortInfo?.audioInfo?.generatedAudioUrl ?? generatedAudioUrl) || undefined} controls style={{ maxWidth: "100%", minWidth: "200px" }} />
                                  <span style={{ fontSize: "14px", color: "var(--p-color-text-success, #008060)", fontWeight: 600 }}>✓ Audio ready</span>
                                  <button
                                    type="button"
                                    disabled={!shortInfo?.shortId || audioSaveLoading}
                                    onClick={async () => {
                                      if (!shortInfo?.shortId || !generatedAudioUrl) return;
                                      setAudioSaveLoading(true); setAudioSavedFeedback(false);
                                      try {
                                        const res = await fetch(AUDIO_SAVE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ short_id: shortInfo.shortId, generated_audio_url: generatedAudioUrl, subtitles: lastSubtitleTiming ?? undefined, voice_id: selectedVoiceId || undefined, voice_name: voicesFetcher.data?.success ? voicesFetcher.data.voices.find((v) => v.voice_id === selectedVoiceId)?.name : undefined }) });
                                        const data = await res.json();
                                        if (data.success) { setAudioSavedFeedback(true); setAudioGenerated(true); setTimeout(() => setAudioSavedFeedback(false), 2000); } else { alert(data.error || "Failed to save audio"); }
                                      } finally { setAudioSaveLoading(false); }
                                    }}
                                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: audioSaveLoading ? "#9ca3af" : "var(--p-color-bg-fill-success, #008060)", color: "#fff", fontWeight: 600, cursor: audioSaveLoading ? "wait" : "pointer", fontSize: "13px" }}
                                  >
                                    {audioSaveLoading ? "Saving…" : "Save audio to database"}
                                  </button>
                                  {audioSavedFeedback && <span style={{ fontSize: "13px", color: "var(--p-color-text-success, #008060)" }}>Saved</span>}
                                </div>
                                <button
                                  type="button"
                                  disabled={!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || !audioScript.trim() || audioGenerateLoading}
                                  onClick={async () => {
                                    if (!shortInfo?.shortId || !shortInfo?.userId || !selectedVoiceId || !audioScript.trim()) return;
                                    setAudioGenerateLoading(true);
                                    try {
                                      const res = await fetch(AUDIO_GENERATE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_id: selectedVoiceId, user_id: shortInfo.userId, short_id: shortInfo.shortId, script: audioScript.trim() }) });
                                      const data = await res.json();
                                      if (data.audio_url) { setGeneratedAudioUrl(data.audio_url); setLastSubtitleTiming(Array.isArray(data.subtitle_timing) ? data.subtitle_timing : null); setAudioGenerated(true); } else { alert(data.error || "Failed to regenerate audio"); }
                                    } finally { setAudioGenerateLoading(false); }
                                  }}
                                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--p-color-border-secondary, #e1e3e5)", background: "#fff", color: "var(--p-color-text-primary, #202223)", fontWeight: 600, cursor: audioGenerateLoading || !audioScript.trim() ? "not-allowed" : "pointer", fontSize: "13px" }}
                                >
                                  {audioGenerateLoading ? "Regenerating audio…" : "Regenerate audio"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {audioStepTab === "bgMusic" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)" }}>Select background music from Storyblocks. Open the picker to search and choose a track; your selection is shown here.</p>
                      {selectedBgMusic && (selectedBgMusic.previewUrl || selectedBgMusic.name) ? (
                        <div style={{ padding: "16px", borderRadius: "10px", background: "#fff", border: "1px solid var(--p-color-border-secondary, #e1e3e5)" }}>
                          <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>Selected track</p>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--p-color-text-primary, #202223)" }}>{selectedBgMusic.name || "Untitled"}</p>
                          {(selectedBgMusic.genre || selectedBgMusic.duration != null) && (
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)" }}>
                              {[selectedBgMusic.genre, selectedBgMusic.duration != null ? `${selectedBgMusic.duration}s` : null].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {selectedBgMusic.previewUrl ? (
                            <>
                              <p style={{ margin: "8px 0 4px", fontSize: "12px", fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>Listen</p>
                              <audio src={selectedBgMusic.previewUrl} controls style={{ width: "100%", maxWidth: "400px", marginTop: "0" }} />
                            </>
                          ) : (
                            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)", fontStyle: "italic" }}>Preview not available</p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => setBgMusicModalOpen(true)}
                              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--p-color-border-secondary, #e1e3e5)", background: "#fff", color: "var(--p-color-text-primary, #202223)", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                            >
                              Change music
                            </button>
                            <button
                              type="button"
                              disabled={!shortInfo?.shortId || bgMusicSaveLoading}
                              onClick={async () => {
                                if (!shortInfo?.shortId) return;
                                setBgMusicSaveLoading(true); setBgMusicSavedFeedback(false);
                                try {
                                  const res = await fetch(SHORTS_SAVE_BG_MUSIC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
                                  short_id: shortInfo.shortId,
                                  bg_music: {
                                    id: selectedBgMusic.id,
                                    name: selectedBgMusic.name,
                                    genre: selectedBgMusic.genre ?? "Storyblocks",
                                    duration: selectedBgMusic.duration ?? null,
                                    previewUrl: selectedBgMusic.previewUrl ?? null,
                                    downloadUrl: selectedBgMusic.downloadUrl ?? selectedBgMusic.previewUrl ?? null,
                                  },
                                }) });
                                  const data = await res.json();
                                  if (data.success) { setBgMusicSavedFeedback(true); setTimeout(() => setBgMusicSavedFeedback(false), 2000); if (productId) loadShortFetcher.load(`${SHORTS_API}?productId=${encodeURIComponent(productId)}`); } else { alert(data.error || "Failed to save"); }
                                } finally { setBgMusicSaveLoading(false); }
                              }}
                              style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: bgMusicSaveLoading ? "#9ca3af" : "var(--p-color-bg-fill-success, #008060)", color: "#fff", fontWeight: 600, cursor: bgMusicSaveLoading ? "wait" : "pointer", fontSize: "14px" }}
                            >
                              {bgMusicSaveLoading ? "Saving…" : "Save background music"}
                            </button>
                            {bgMusicSavedFeedback && <span style={{ fontSize: "14px", color: "var(--p-color-text-success, #008060)", fontWeight: 600 }}>Saved</span>}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBgMusicModalOpen(true)}
                          style={{
                            padding: "14px 24px",
                            borderRadius: "10px",
                            border: "2px dashed var(--p-color-border-secondary, #e1e3e5)",
                            background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                            color: "var(--p-color-text-info, #2c6ecb)",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "14px",
                          }}
                        >
                          Browse music from Storyblocks
                        </button>
                      )}
                      <StoryblocksMusicModal
                        open={bgMusicModalOpen}
                        onClose={() => setBgMusicModalOpen(false)}
                        onSelect={(track) => {
                          setSelectedBgMusic(track);
                          setBgMusicModalOpen(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {allScenesComplete && (
              <div
                style={{
                  padding: "12px 20px",
                  background: "var(--p-color-bg-fill-success-secondary, #e3f1df)",
                  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizeLoading || !shortInfo?.shortId}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: finalizeLoading || !shortInfo?.shortId ? "#9ca3af" : "var(--p-color-bg-fill-success, #008060)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: finalizeLoading || !shortInfo?.shortId ? "not-allowed" : "pointer",
                    fontSize: "14px",
                  }}
                >
                  {finalizeLoading ? "Merging…" : "Finalize"}
                </button>
                {finalizeProgress != null && (
                  <span style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)" }}>{finalizeProgress}%</span>
                )}
                {finalizeError && (
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{finalizeError}</span>
                )}
              </div>
            )}

            <div style={{ padding: "24px", overflow: "auto", flex: 1 }}>
              <div style={{ display: activeTab === "scene1" ? "block" : "none" }} key={`scene1-${scene1ResetKey}`}>
                <Scene1Content
                  productImages={productImages}
                  productId={productId ?? undefined}
                  product={product ?? undefined}
                  sceneId={shortInfo?.scene1Id ?? undefined}
                  shortId={shortInfo?.shortId ?? undefined}
                  shortUserId={shortInfo?.userId ?? undefined}
                  initialScene1={scene1Regenerated ? undefined : (restoredState?.scene1 ?? scene1Snapshot)}
                  dbSceneVideoUrl={scene1Regenerated ? undefined : (shortInfo?.scene1GeneratedVideoUrl ?? undefined)}
                  onScene1Change={setScene1Snapshot}
                  onComplete={() => {
                    setScene1Complete(true);
                    setScene1Regenerated(false);
                  }}
                  onRegenerate={handleRegenerateScene1}
                  onSkipRemoveBgWarning={showSkipRemoveBgWarning}
                />
              </div>
              <div style={{ display: activeTab === "scene2" ? "block" : "none" }} key={`scene2-${scene2ResetKey}`}>
                <Scene2Content
                  productImages={productImages}
                  sceneId={shortInfo?.scene2Id ?? undefined}
                  shortUserId={shortInfo?.userId ?? undefined}
                  initialScene2={scene2Regenerated ? undefined : (restoredState?.scene2 ?? scene2Snapshot)}
                  dbSceneVideoUrl={scene2Regenerated ? undefined : (shortInfo?.scene2GeneratedVideoUrl ?? undefined)}
                  onScene2Change={setScene2Snapshot}
                  onComplete={() => {
                    setScene2Complete(true);
                    setScene2Regenerated(false);
                  }}
                  onRegenerate={handleRegenerateScene2}
                  onSkipRemoveBgWarning={showSkipRemoveBgWarning}
                />
              </div>
              <div style={{ display: activeTab === "scene3" ? "block" : "none" }} key={`scene3-${scene3ResetKey}`}>
                <Scene3Content
                  productImages={productImages}
                  productId={productId ?? undefined}
                  product={product ?? undefined}
                  sceneId={shortInfo?.scene3Id ?? undefined}
                  shortId={shortInfo?.shortId ?? undefined}
                  shortUserId={shortInfo?.userId ?? undefined}
                  initialScene3={scene3Regenerated ? undefined : (restoredState?.scene3 ?? scene3Snapshot)}
                  dbSceneVideoUrl={scene3Regenerated ? undefined : (shortInfo?.scene3GeneratedVideoUrl ?? undefined)}
                  onScene3Change={setScene3Snapshot}
                  onComplete={() => {
                    setScene3Complete(true);
                    setScene3Regenerated(false);
                  }}
                  onRegenerate={handleRegenerateScene3}
                  onSkipRemoveBgWarning={showSkipRemoveBgWarning}
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
const SHORTS_RESET_API = "/app/api/shorts/reset";
const REMOTION_START_API = "/app/api/remotion/start";
const TASKS_API_BASE = "/app/api/tasks";
const AUDIO_VOICES_API = "/app/api/audio/voices";
const AUDIO_GENERATE_SCRIPT_API = "/app/api/audio/generate-script";
const AUDIO_GENERATE_API = "/app/api/audio/generate";
const AUDIO_SAVE_SCRIPT_API = "/app/api/audio/save-script";
const AUDIO_SAVE_API = "/app/api/audio/save";
const AUDIO_CONFIG_API = "/app/api/audio/config";
const STORYBLOCKS_MUSIC_API = "/app/api/storyblocks/music";
const LOCAL_MUSIC_API = "/app/api/music/local";
const SHORTS_SAVE_BG_MUSIC_API = "/app/api/shorts/save-bg-music";
const MERGE_FINALIZE_API = "/app/api/merge/finalize";
const MERGE_STATUS_API_BASE = "/app/api/merge/status";
const SHORTS_SAVE_FINAL_VIDEO_API = "/app/api/shorts/save-final-video";
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
  scene1: { step: number; selectedImage: string | null; bgRemoved: string | null; skipRemoveBg: boolean; bgImage: string | null; composited: string | null; sceneVideo: string | null };
  scene2: { step: number; selectedImage: string | null; bgRemoved: string | null; skipRemoveBg: boolean; selectedStockVideoUrl: string | null; sceneVideo: string | null };
  scene3: { step: number; selectedImage: string | null; bgRemoved: string | null; skipRemoveBg: boolean; bgImage: string | null; composited: string | null; sceneVideo: string | null };
};

const SKIP_REMOVE_BG_WARNING = "Skipping background removal may reduce the quality of your final image and video.";

const defaultScene1State = (firstImageId: string): WorkflowTempState["scene1"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  skipRemoveBg: false,
  bgImage: null,
  composited: null,
  sceneVideo: null,
});
const defaultScene2State = (firstImageId: string): WorkflowTempState["scene2"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  skipRemoveBg: false,
  selectedStockVideoUrl: null,
  sceneVideo: null,
});
const defaultScene3State = (firstImageId: string): WorkflowTempState["scene3"] => ({
  step: 1,
  selectedImage: firstImageId,
  bgRemoved: null,
  skipRemoveBg: false,
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
  dbSceneVideoUrl,
  onScene1Change,
  onComplete,
  onRegenerate,
  onSkipRemoveBgWarning,
}: {
  productImages: ProductImageItem[];
  productId?: string | null;
  product?: WorkflowProduct | null;
  sceneId?: string | null;
  shortId?: string | null;
  shortUserId?: string | null;
  initialScene1?: Scene1State | null;
  /** Display URL from DB (video_scenes.generated_video_url); preferred over state from temp */
  dbSceneVideoUrl?: string | null;
  onScene1Change?: (s: Scene1State) => void;
  onComplete?: () => void;
  onRegenerate?: () => void;
  onSkipRemoveBgWarning?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene1?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene1?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene1?.bgRemoved ?? null);
  const [skipRemoveBg, setSkipRemoveBg] = useState(initialScene1?.skipRemoveBg ?? false);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(initialScene1?.bgImage ?? null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [aiBgModalOpen, setAiBgModalOpen] = useState(false);
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
      skipRemoveBg,
      bgImage,
      composited,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, skipRemoveBg, bgImage, composited, sceneVideo, onScene1Change]);

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

  const handleGenerateBg = async (opts: AIBackgroundGenerateOpts) => {
    const LOG_BG = "[BG Scene1]";
    const product_description = typeof productProp?.description === "string" ? productProp.description.trim() : "";
    const user_id = shortUserId ?? "anonymous";
    const scene_id = videoSceneId ?? (productId ? `${productId}-scene1` : `scene1-${Date.now()}`);
    const short_id = shortId ?? undefined;
    setBgError(null);
    setBgLoading(true);
    console.log(`${LOG_BG} [1] Start background generation`, { mode: opts.mode, scene_id, short_id });
    try {
      const body: Record<string, string> = {
        product_description: product_description || "Product",
        user_id,
      };
      if (scene_id) body.scene_id = scene_id;
      if (short_id) body.short_id = short_id;
      if (opts.mode === "manual") {
        body.manual_prompt = opts.manual_prompt;
      } else {
        body.mood = opts.mood;
        body.style = opts.style;
        body.environment = opts.environment;
      }
      console.log(`${LOG_BG} [2] POST ${BACKGROUND_GENERATE_API}`, { keys: Object.keys(body) });
      const res = await fetch(BACKGROUND_GENERATE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; task_id?: string; error?: string };
      console.log(`${LOG_BG} [3] Generate response`, { ok: data.ok, task_id: data.task_id ?? null, error: data.error ?? null });
      if (!data.ok || !data.task_id) {
        setBgError(data.error ?? "Failed to start background generation");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      console.log(`${LOG_BG} [4] Polling status (max ${BACKGROUND_POLL_MAX_ATTEMPTS} attempts, interval ${BACKGROUND_POLL_INTERVAL_MS}ms)`);
      for (let i = 0; i < BACKGROUND_POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, BACKGROUND_POLL_INTERVAL_MS));
        const statusRes = await fetch(`${BACKGROUND_STATUS_API_BASE}/${encodeURIComponent(data.task_id)}`, {
          credentials: "include",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const statusData = (await statusRes.json()) as { status?: string; image_url?: string | null; error?: string | null };
        if (i === 0 || statusData.status === "completed" || statusData.status === "failed") {
          console.log(`${LOG_BG} [5] Poll #${i + 1} status=${statusData.status}`, statusData.image_url ? "image_url present" : "", statusData.error ?? "");
        }
        if (statusData.status === "completed" && statusData.image_url) {
          const url = statusData.image_url.startsWith("http") ? statusData.image_url : `${origin}${statusData.image_url}`;
          setBgImage(url);
          setBgError(null);
          console.log(`${LOG_BG} [6] Completed → image set`);
          return;
        }
        if (statusData.status === "failed") {
          setBgError(statusData.error ?? "Background generation failed");
          console.log(`${LOG_BG} [6] Failed:`, statusData.error);
          return;
        }
      }
      setBgError("Background generation timed out. Please try again.");
      console.log(`${LOG_BG} [6] Timeout after ${BACKGROUND_POLL_MAX_ATTEMPTS} polls`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Background generation failed";
      setBgError(msg);
      console.log(`${LOG_BG} [6] Error:`, msg);
    } finally {
      setBgLoading(false);
    }
  };

  const effectiveOverlayUrl = bgRemoved ?? (skipRemoveBg ? (productImagesProp.find((i) => i.id === selectedImage)?.src ?? null) : null);

  const handleComposite = async () => {
    if (!effectiveOverlayUrl || !bgImage) return;
    setCompositeError(null);
    setCompositeLoading(true);
    const sceneLabel = "Scene 1";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const overlayUrl = effectiveOverlayUrl.startsWith("http") ? effectiveOverlayUrl : `${origin}${effectiveOverlayUrl}`;
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
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const task = await pollRes.json().catch(() => ({}));
        setSceneProgress(task.progress ?? null);
        // Remotion response shape: status "completed", stage "done", progress 100, videoUrl (relative path)
        if (task.status === "completed" && (task.videoUrl ?? task.video_url)) {
          const rawUrl = task.videoUrl ?? task.video_url;
          const videoUrl = typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl}`;
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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
            <button
              type="button"
              onClick={() => {
                setSkipRemoveBg(true);
                onSkipRemoveBgWarning?.();
                setStep(2);
              }}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                background: "transparent",
                color: "var(--p-color-text-primary, #202223)",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              Skip
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {(bgRemoved || skipRemoveBg) && (
              <>
                {bgRemoved && (
                  <img
                    src={bgRemoved}
                    alt="BG removed"
                    style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }}
                  />
                )}
                {skipRemoveBg && !bgRemoved && (
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Using image as-is</span>
                )}
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
              {effectiveOverlayUrl ? (
                <img src={effectiveOverlayUrl} alt="Subject" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, position: "relative" }}>
              {bgLoading ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "var(--p-color-bg-surface-secondary, #f6f6f7)", zIndex: 2 }}>
                  <div style={{ width: "70%", maxWidth: "220px", height: "6px", borderRadius: "3px", background: "var(--p-color-border-secondary, #e1e3e5)", overflow: "hidden" }}>
                    <div style={{ width: "40%", height: "100%", borderRadius: "3px", background: "var(--p-color-bg-fill-info, #2c6ecb)", animation: "bgLoadingBar 1.2s ease-in-out infinite" }} />
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Generating background…</span>
                </div>
              ) : null}
              {!bgLoading && (
                <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 1 }}>
                  <button
                    type="button"
                    onClick={() => setAiBgModalOpen(true)}
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
                <img key={bgImage} src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <AIBackgroundModal
              open={aiBgModalOpen}
              onClose={() => setAiBgModalOpen(false)}
              onGenerate={(opts) => {
                setAiBgModalOpen(false);
                handleGenerateBg(opts);
              }}
              productDescription={typeof productProp?.description === "string" ? productProp.description : ""}
            />
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
                disabled={!bgImage || !effectiveOverlayUrl || compositeLoading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: compositeLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: !bgImage || !effectiveOverlayUrl || compositeLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {compositeLoading ? "Compositing…" : "Composite"}
              </button>
            </div>
          </div>
          {bgError && (
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgError}</p>
          )}
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", minWidth: "200px" }}>
                  <div style={{ width: "100%", maxWidth: "280px", height: "8px", borderRadius: "4px", background: "var(--p-color-border-secondary, #e1e3e5)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, sceneProgress ?? 0))}%`,
                        borderRadius: "4px",
                        background: "var(--p-color-bg-fill-info, #2c6ecb)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)", textAlign: "center" }}>Generating scene video…</span>
                  {sceneProgress != null && (
                    <span style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)", textAlign: "center" }}>{sceneProgress}%</span>
                  )}
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
              ) : (dbSceneVideoUrl ?? sceneVideo) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <video src={dbSceneVideoUrl ?? sceneVideo ?? undefined} controls style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
                  {onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                      }}
                    >
                      Regenerate
                    </button>
                  )}
                </div>
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
  sceneId: scene2Id,
  shortUserId,
  initialScene2,
  dbSceneVideoUrl,
  onScene2Change,
  onComplete,
  onRegenerate,
  onSkipRemoveBgWarning,
}: {
  productImages: ProductImageItem[];
  sceneId?: string | null;
  shortUserId?: string | null;
  initialScene2?: Scene2State | null;
  /** Display URL from DB (video_scenes.generated_video_url); preferred over state from temp */
  dbSceneVideoUrl?: string | null;
  onScene2Change?: (s: Scene2State) => void;
  onComplete?: () => void;
  onRegenerate?: () => void;
  onSkipRemoveBgWarning?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene2?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene2?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene2?.bgRemoved ?? null);
  const [skipRemoveBg, setSkipRemoveBg] = useState(initialScene2?.skipRemoveBg ?? false);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedStockVideoUrl, setSelectedStockVideoUrl] = useState<string | null>(initialScene2?.selectedStockVideoUrl ?? null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(initialScene2?.sceneVideo ?? null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneProgress, setSceneProgress] = useState<number | null>(null);
  const [sceneMessage, setSceneMessage] = useState<string | null>(null);

  useEffect(() => {
    onScene2Change?.({
      step,
      selectedImage,
      bgRemoved,
      skipRemoveBg,
      selectedStockVideoUrl,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, skipRemoveBg, selectedStockVideoUrl, sceneVideo, onScene2Change]);

  const removeBgFetcher = useFetcher<{ ok: boolean; url?: string; error?: string }>();

  useEffect(() => {
    if (removeBgFetcher.state !== "idle" || !removeBgFetcher.data) return;
    setBgRemovedLoading(false);
    const data = removeBgFetcher.data;
    if (data.ok && data.url) {
      setBgRemoved(data.url);
      setBgRemovedError(null);
      // Save scene2 image_url to DB (video_scenes.image_url) — same pattern as other scenes: /bg_removed_images/{filename}
      if (scene2Id && data.url) {
        fetch(SHORTS_SCENES_API, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sceneId: scene2Id, imageUrl: data.url }),
        })
          .then((r) => (r.ok ? Promise.resolve() : Promise.reject(new Error(r.statusText))))
          .then(() => console.log("[Scene2] Saved image_url to VideoScene:", data.url))
          .catch((err) => console.warn("[Scene2] Failed to save image_url:", err));
      }
    } else {
      setBgRemovedError(data.error ?? "Remove BG failed");
    }
  }, [removeBgFetcher.state, removeBgFetcher.data, scene2Id]);

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

  const effectiveOverlayUrl = bgRemoved ?? (skipRemoveBg ? (productImagesProp.find((i) => i.id === selectedImage)?.src ?? null) : null);

  const handleGenerateVideo = async () => {
    if (!effectiveOverlayUrl || !selectedStockVideoUrl || !scene2Id || !shortUserId) {
      setSceneError("Missing image, video, or scene. Ensure BG is removed or skipped, a stock video is selected, and the short is loaded.");
      return;
    }
    setSceneError(null);
    setSceneProgress(null);
    setSceneMessage(null);
    setSceneLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const product_image_url = effectiveOverlayUrl.startsWith("http") ? effectiveOverlayUrl : `${origin}${effectiveOverlayUrl}`;
      const background_video_url = selectedStockVideoUrl.startsWith("http") ? selectedStockVideoUrl : `${origin}${selectedStockVideoUrl}`;
      const res = await fetch(VIDEO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          step: "mergeVideo",
          product_image_url,
          background_video_url,
          scene_id: scene2Id,
          user_id: shortUserId,
        }),
      });
      const rawText = await res.text();
      let data: { taskId?: string; task_id?: string; error?: string; data?: { taskId?: string; task_id?: string } } = {};
      try {
        data = rawText && rawText.trim() ? JSON.parse(rawText) : {};
      } catch {
        console.warn("[Scene2] Start response not JSON. Status:", res.status, "Body sample:", rawText.slice(0, 200));
      }
      const taskId = data?.taskId ?? data?.task_id ?? data?.data?.taskId ?? data?.data?.task_id;
      if (!taskId) {
        const errMsg = typeof data?.error === "string" ? data.error : !res.ok ? `Server error ${res.status}` : "Failed to start video generation";
        console.warn("[Scene2] Generate video start failed:", {
          status: res.status,
          dataKeys: typeof data === "object" && data !== null ? Object.keys(data) : [],
          bodySample: rawText.slice(0, 300),
          error: errMsg,
        });
        setSceneError(errMsg);
        setSceneLoading(false);
        return;
      }
      console.log("[Scene2] Start OK, polling taskId=" + taskId + " at " + TASKS_API_BASE + "/" + taskId);
      let done = false;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const pollUrl = `${TASKS_API_BASE}/${encodeURIComponent(taskId)}`;
        const pollRes = await fetch(pollUrl, {
          credentials: "include",
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const task = (await pollRes.json().catch(() => ({}))) as {
          status?: string;
          videoUrl?: string;
          video_url?: string;
          progress?: number | null;
          message?: string | null;
          error?: string;
        };
        if (task.progress != null) setSceneProgress(Number(task.progress));
        if (task.message != null) setSceneMessage(typeof task.message === "string" ? task.message : null);
        if (!pollRes.ok) {
          console.warn("[Scene2] Poll error:", pollRes.status, task);
          if (task?.error) {
            setSceneError(typeof task.error === "string" ? task.error : "Poll failed");
            done = true;
            break;
          }
        }
        if (i < 3 || task.status === "completed" || task.status === "failed") {
          console.log("[Scene2] Poll", i + 1, "status=" + (task.status ?? "?") + " progress=" + (task.progress ?? "-") + " videoUrl=" + (task.videoUrl ?? task.video_url ?? "-"));
        }
        if (task.status === "completed" && (task.videoUrl ?? task.video_url)) {
          const rawUrl = task.videoUrl ?? task.video_url ?? "";
          const videoUrl = typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
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
      setSceneError(e instanceof Error ? e.message : "Generate video failed");
    } finally {
      setSceneLoading(false);
      setSceneProgress(null);
      setSceneMessage(null);
    }
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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
            <button
              type="button"
              onClick={() => {
                setSkipRemoveBg(true);
                onSkipRemoveBgWarning?.();
                setStep(2);
              }}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                background: "transparent",
                color: "var(--p-color-text-primary, #202223)",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              Skip
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {(bgRemoved || skipRemoveBg) && (
              <>
                {bgRemoved && (
                  <img src={bgRemoved} alt="BG removed" style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
                )}
                {skipRemoveBg && !bgRemoved && (
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Using image as-is</span>
                )}
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
          <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
            <div style={{ flex: "1 1 260px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {sceneLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", minWidth: "200px" }}>
                  <div style={{ width: "100%", maxWidth: "280px", height: "8px", borderRadius: "4px", background: "var(--p-color-border-secondary, #e1e3e5)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, sceneProgress ?? 0))}%`,
                        borderRadius: "4px",
                        background: "var(--p-color-bg-fill-info, #2c6ecb)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)", textAlign: "center" }}>
                    {sceneMessage ?? "Generating video…"}
                  </span>
                  {sceneProgress != null && (
                    <span style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)" }}>{sceneProgress}%</span>
                  )}
                </div>
              ) : (dbSceneVideoUrl ?? sceneVideo) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <video src={dbSceneVideoUrl ?? sceneVideo ?? undefined} controls style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
                  {onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                      }}
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateVideo}
                  disabled={!selectedStockVideoUrl || !effectiveOverlayUrl || !scene2Id || !shortUserId || sceneLoading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: !selectedStockVideoUrl || !effectiveOverlayUrl || !scene2Id ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: !selectedStockVideoUrl || !effectiveOverlayUrl || !scene2Id ? "not-allowed" : "pointer",
                  }}
                >
                  Generate video
                </button>
              )}
              {sceneError && (
                <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{sceneError}</span>
              )}
            </div>
          </div>
          <FetchVideoModal
            open={videoModalOpen}
            onClose={() => setVideoModalOpen(false)}
            onSelect={(url) => { setSelectedStockVideoUrl(url); setVideoModalOpen(false); }}
          />
        </>
      )}
    </div>
  );
}

type Scene3State = WorkflowTempState["scene3"];

function Scene3Content({
  productImages: productImagesProp,
  productId,
  product: productProp,
  sceneId: videoSceneId,
  shortId,
  shortUserId,
  initialScene3,
  dbSceneVideoUrl,
  onScene3Change,
  onComplete,
  onRegenerate,
  onSkipRemoveBgWarning,
}: {
  productImages: ProductImageItem[];
  productId?: string | null;
  product?: WorkflowProduct | null;
  sceneId?: string | null;
  shortId?: string | null;
  shortUserId?: string | null;
  initialScene3?: Scene3State | null;
  /** Display URL from DB (video_scenes.generated_video_url); preferred over state from temp */
  dbSceneVideoUrl?: string | null;
  onScene3Change?: (s: Scene3State) => void;
  onComplete?: () => void;
  onRegenerate?: () => void;
  onSkipRemoveBgWarning?: () => void;
}) {
  const firstId = productImagesProp[0]?.id ?? "s1";
  const [step, setStep] = useState(initialScene3?.step ?? 1);
  const [selectedImage, setSelectedImage] = useState<string | null>(initialScene3?.selectedImage ?? firstId);
  const [bgRemoved, setBgRemoved] = useState<string | null>(initialScene3?.bgRemoved ?? null);
  const [skipRemoveBg, setSkipRemoveBg] = useState(initialScene3?.skipRemoveBg ?? false);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgRemovedError, setBgRemovedError] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(initialScene3?.bgImage ?? null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [aiBgModalOpen, setAiBgModalOpen] = useState(false);
  const [composited, setComposited] = useState<string | null>(initialScene3?.composited ?? null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [compositeError, setCompositeError] = useState<string | null>(null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(initialScene3?.sceneVideo ?? null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneProgress, setSceneProgress] = useState<number | null>(null);

  useEffect(() => {
    onScene3Change?.({
      step,
      selectedImage,
      bgRemoved,
      skipRemoveBg,
      bgImage,
      composited,
      sceneVideo,
    });
  }, [step, selectedImage, bgRemoved, skipRemoveBg, bgImage, composited, sceneVideo, onScene3Change]);

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

  const effectiveOverlayUrl = bgRemoved ?? (skipRemoveBg ? (productImagesProp.find((i) => i.id === selectedImage)?.src ?? null) : null);

  const handleGenerateBg = async (opts: AIBackgroundGenerateOpts) => {
    const LOG_BG = "[BG Scene3]";
    const product_description = typeof productProp?.description === "string" ? productProp.description.trim() : "";
    const user_id = shortUserId ?? "anonymous";
    const scene_id = videoSceneId ?? (productId ? `${productId}-scene3` : `scene3-${Date.now()}`);
    const short_id = shortId ?? undefined;
    setBgError(null);
    setBgLoading(true);
    console.log(`${LOG_BG} [1] Start background generation`, { mode: opts.mode, scene_id, short_id });
    try {
      const body: Record<string, string> = {
        product_description: product_description || "Product",
        user_id,
      };
      if (scene_id) body.scene_id = scene_id;
      if (short_id) body.short_id = short_id;
      if (opts.mode === "manual") {
        body.manual_prompt = opts.manual_prompt;
      } else {
        body.mood = opts.mood;
        body.style = opts.style;
        body.environment = opts.environment;
      }
      console.log(`${LOG_BG} [2] POST ${BACKGROUND_GENERATE_API}`, { keys: Object.keys(body) });
      const res = await fetch(BACKGROUND_GENERATE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; task_id?: string; error?: string };
      console.log(`${LOG_BG} [3] Generate response`, { ok: data.ok, task_id: data.task_id ?? null, error: data.error ?? null });
      if (!data.ok || !data.task_id) {
        setBgError(data.error ?? "Failed to start background generation");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      console.log(`${LOG_BG} [4] Polling status (max ${BACKGROUND_POLL_MAX_ATTEMPTS} attempts, interval ${BACKGROUND_POLL_INTERVAL_MS}ms)`);
      for (let i = 0; i < BACKGROUND_POLL_MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, BACKGROUND_POLL_INTERVAL_MS));
        const statusRes = await fetch(`${BACKGROUND_STATUS_API_BASE}/${encodeURIComponent(data.task_id)}`, {
          credentials: "include",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const statusData = (await statusRes.json()) as { status?: string; image_url?: string | null; error?: string | null };
        if (i === 0 || statusData.status === "completed" || statusData.status === "failed") {
          console.log(`${LOG_BG} [5] Poll #${i + 1} status=${statusData.status}`, statusData.image_url ? "image_url present" : "", statusData.error ?? "");
        }
        if (statusData.status === "completed" && statusData.image_url) {
          const url = statusData.image_url.startsWith("http") ? statusData.image_url : `${origin}${statusData.image_url}`;
          setBgImage(url);
          setBgError(null);
          console.log(`${LOG_BG} [6] Completed → image set`);
          return;
        }
        if (statusData.status === "failed") {
          setBgError(statusData.error ?? "Background generation failed");
          console.log(`${LOG_BG} [6] Failed:`, statusData.error);
          return;
        }
      }
      setBgError("Background generation timed out. Please try again.");
      console.log(`${LOG_BG} [6] Timeout after ${BACKGROUND_POLL_MAX_ATTEMPTS} polls`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Background generation failed";
      setBgError(msg);
      console.log(`${LOG_BG} [6] Error:`, msg);
    } finally {
      setBgLoading(false);
    }
  };

  const handleComposite = async () => {
    if (!effectiveOverlayUrl || !bgImage) return;
    setCompositeError(null);
    setCompositeLoading(true);
    const sceneLabel = "Scene 3";
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const overlayUrl = effectiveOverlayUrl.startsWith("http") ? effectiveOverlayUrl : `${origin}${effectiveOverlayUrl}`;
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
          template: "product-minimal-v1",
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
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        const task = await pollRes.json().catch(() => ({}));
        setSceneProgress(task.progress ?? null);
        if (task.status === "completed" && (task.videoUrl ?? task.video_url)) {
          const rawUrl = task.videoUrl ?? task.video_url;
          const videoUrl = typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl}`;
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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
            <button
              type="button"
              onClick={() => {
                setSkipRemoveBg(true);
                onSkipRemoveBgWarning?.();
                setStep(2);
              }}
              disabled={bgRemovedLoading}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                background: "transparent",
                color: "var(--p-color-text-primary, #202223)",
                fontWeight: 600,
                cursor: bgRemovedLoading ? "wait" : "pointer",
              }}
            >
              Skip
            </button>
            {bgRemovedError && (
              <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgRemovedError}</span>
            )}
            {(bgRemoved || skipRemoveBg) && (
              <>
                {bgRemoved && (
                  <img src={bgRemoved} alt="BG removed" style={{ width: "160px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
                )}
                {skipRemoveBg && !bgRemoved && (
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Using image as-is</span>
                )}
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
              {effectiveOverlayUrl ? (
                <img src={effectiveOverlayUrl} alt="Subject" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <div style={{ ...boxStyle, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, position: "relative" }}>
              {bgLoading ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "var(--p-color-bg-surface-secondary, #f6f6f7)", zIndex: 2 }}>
                  <div style={{ width: "70%", maxWidth: "220px", height: "6px", borderRadius: "3px", background: "var(--p-color-border-secondary, #e1e3e5)", overflow: "hidden" }}>
                    <div style={{ width: "40%", height: "100%", borderRadius: "3px", background: "var(--p-color-bg-fill-info, #2c6ecb)", animation: "bgLoadingBar 1.2s ease-in-out infinite" }} />
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>Generating background…</span>
                </div>
              ) : null}
              {!bgLoading && (
                <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 1 }}>
                  <button
                    type="button"
                    onClick={() => setAiBgModalOpen(true)}
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
                <img key={bgImage} src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : null}
            </div>
            <AIBackgroundModal
              open={aiBgModalOpen}
              onClose={() => setAiBgModalOpen(false)}
              onGenerate={(opts) => {
                setAiBgModalOpen(false);
                handleGenerateBg(opts);
              }}
              productDescription={typeof productProp?.description === "string" ? productProp.description : ""}
            />
            <FetchBackgroundModal
              open={fetchModalOpen}
              onClose={() => setFetchModalOpen(false)}
              onSelect={(url) => setBgImage(url)}
            />
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 2 }}>
              <button
                type="button"
                onClick={handleComposite}
                disabled={!bgImage || !effectiveOverlayUrl || compositeLoading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: compositeLoading ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: !bgImage || !effectiveOverlayUrl || compositeLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {compositeLoading ? "Compositing…" : "Composite"}
              </button>
            </div>
          </div>
          {bgError && (
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{bgError}</p>
          )}
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", minWidth: "200px" }}>
                  <div style={{ width: "100%", maxWidth: "280px", height: "8px", borderRadius: "4px", background: "var(--p-color-border-secondary, #e1e3e5)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, sceneProgress ?? 0))}%`,
                        borderRadius: "4px",
                        background: "var(--p-color-bg-fill-info, #2c6ecb)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)", textAlign: "center" }}>Generating scene video…</span>
                  {sceneProgress != null && (
                    <span style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)", textAlign: "center" }}>{sceneProgress}%</span>
                  )}
                </div>
              ) : (dbSceneVideoUrl ?? sceneVideo) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <video src={dbSceneVideoUrl ?? sceneVideo ?? undefined} controls style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
                  {onRegenerate && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                      }}
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateScene}
                  disabled={!composited || !shortId || !shortUserId}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: !composited || !shortId ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: !composited || !shortId ? "not-allowed" : "pointer",
                  }}
                >
                  Generate scene
                </button>
              )}
            </div>
          </div>
          {sceneError && (
            <span style={{ fontSize: "14px", color: "var(--p-color-text-critical, #d72c0d)" }}>{sceneError}</span>
          )}
        </>
      )}
    </div>
  );
}
