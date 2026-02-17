import { useState } from "react";
import { useSearchParams, Link } from "react-router";

const base = "/mockup";

const workflowSteps = [
  // ——— Scene 1 ———
  {
    phase: "Scene 1",
    phaseLabel: "Scene 1 — Image + background → Remotion",
    title: "Select image for Scene 1",
    body: "Choose a product image. This will be the main subject for the first ~8s of your promo.",
    src: `${base}/scene1-original.jpg`,
    type: "image" as const,
  },
  {
    phase: "Scene 1",
    phaseLabel: "Scene 1 — Image + background → Remotion",
    title: "Remove background",
    body: "Background has been removed from your image.",
    src: `${base}/scene1-bg removed.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 1",
    phaseLabel: "Scene 1 — Image + background → Remotion",
    title: "Choose background",
    body: "Generate a new background or pick one from the library.",
    src: `${base}/scene1-bg.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 1",
    phaseLabel: "Scene 1 — Image + background → Remotion",
    title: "Composite",
    body: "Subject and background composited. Ready for video generation.",
    src: `${base}/scene1-composited.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 1",
    phaseLabel: "Scene 1 — Image + background → Remotion",
    title: "Generate scene video",
    body: "Scene 1 video (~8s) created with Remotion.",
    src: `${base}/scene1-video.mp4`,
    type: "video" as const,
  },
  // ——— Scene 2 ———
  {
    phase: "Scene 2",
    phaseLabel: "Scene 2 — Image + stock video",
    title: "Select image for Scene 2",
    body: "Choose a product image for the second scene.",
    src: `${base}/scene2-original.jpg`,
    type: "image" as const,
  },
  {
    phase: "Scene 2",
    phaseLabel: "Scene 2 — Image + stock video",
    title: "Remove background",
    body: "Background removed. Next: pick a stock video.",
    src: `${base}/scene2-bg removed.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 2",
    phaseLabel: "Scene 2 — Image + stock video",
    title: "Select stock video",
    body: "Choose a video from Pexels, Pixabay, or Coverr as the background.",
    src: `${base}/scene2-video preview.jpg`,
    type: "image" as const,
  },
  {
    phase: "Scene 2",
    phaseLabel: "Scene 2 — Image + stock video",
    title: "Composite to video",
    body: "Subject composited onto the stock video. Scene 2 (~8s) ready.",
    src: `${base}/scene2-video.mp4`,
    type: "video" as const,
  },
  // ——— Scene 3 ———
  {
    phase: "Scene 3",
    phaseLabel: "Scene 3 — Image + background → Remotion (different style)",
    title: "Select image for Scene 3",
    body: "Choose a product image for the third scene.",
    src: `${base}/scene3-original.jpg`,
    type: "image" as const,
  },
  {
    phase: "Scene 3",
    phaseLabel: "Scene 3 — Image + background → Remotion (different style)",
    title: "Remove background",
    body: "Background removed.",
    src: `${base}/scene3-bg removed.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 3",
    phaseLabel: "Scene 3 — Image + background → Remotion (different style)",
    title: "Choose background",
    body: "Generate or fetch background for Scene 3.",
    src: `${base}/scene3-bg.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 3",
    phaseLabel: "Scene 3 — Image + background → Remotion (different style)",
    title: "Composite",
    body: "Composited. Different Remotion style will be applied.",
    src: `${base}/scene3-compositied.png`,
    type: "image" as const,
  },
  {
    phase: "Scene 3",
    phaseLabel: "Scene 3 — Image + background → Remotion (different style)",
    title: "Generate scene video",
    body: "Scene 3 video (~8s) created.",
    src: `${base}/scene3-video.mp4`,
    type: "video" as const,
  },
  // ——— Audio & music (optional) ———
  {
    phase: "Audio & music",
    phaseLabel: "Optional: audio & music",
    title: "Add voiceover or audio",
    body: "Generate or upload audio (max 24s). Optional — you can skip.",
    src: null,
    type: "image" as const,
  },
  {
    phase: "Audio & music",
    phaseLabel: "Optional: audio & music",
    title: "Select music",
    body: "Pick a music track to overlay. Optional — you can skip.",
    src: null,
    type: "image" as const,
  },
  // ——— Merge ———
  {
    phase: "Final",
    phaseLabel: "Final video",
    title: "Merge and export",
    body: "All scenes, audio, and music are merged into your final promo video.",
    src: `${base}/final.mp4`,
    type: "video" as const,
  },
];

const totalSteps = workflowSteps.length;

export default function MockupPage() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId");
  const [step, setStep] = useState(0);

  const current = workflowSteps[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  const progressPct = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0;

  return (
    <s-page heading="Create promo video">
      {productId ? (
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-paragraph>
            Creating promo for product <s-text fontWeight="bold">{productId}</s-text>
          </s-paragraph>
        </s-box>
      ) : null}

      <s-section heading="Progress">
        <s-stack direction="block" gap="tight">
          <s-paragraph tone="subdued">
            Step {step + 1} of {totalSteps} · {current.phase}
          </s-paragraph>
          <div
            style={{
              height: "8px",
              backgroundColor: "var(--p-color-bg-surface-secondary, #e1e3e5)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                backgroundColor: "var(--p-color-bg-fill-info, #2c6ecb)",
                borderRadius: "4px",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </s-stack>
      </s-section>

      <s-section heading={current.phaseLabel}>
        <s-stack direction="block" gap="base">
          <s-heading>{current.title}</s-heading>
          <s-paragraph tone="subdued">{current.body}</s-paragraph>

          {current.src ? (
            <div style={{ marginTop: "8px" }}>
              {current.type === "image" ? (
                <img
                  src={current.src}
                  alt={current.title}
                  style={{
                    maxWidth: "100%",
                    width: "400px",
                    height: "auto",
                    display: "block",
                    borderRadius: "12px",
                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                />
              ) : (
                <video
                  src={current.src}
                  controls
                  style={{
                    maxWidth: "100%",
                    width: "500px",
                    maxHeight: "320px",
                    borderRadius: "12px",
                    border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                />
              )}
            </div>
          ) : (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
              minBlockSize="120px"
            >
              <s-paragraph tone="subdued">
                {current.phase === "Audio & music"
                  ? "In the real app you’ll generate or upload audio, and pick a music track here."
                  : "Preview will appear here."}
              </s-paragraph>
            </s-box>
          )}

          <s-stack direction="inline" gap="base" style={{ marginTop: "16px" }}>
            {!isFirst ? (
              <s-button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                ← Back
              </s-button>
            ) : null}
            {isLast ? (
              <>
                <s-button variant="primary" onClick={() => setStep(0)}>
                  Start over
                </s-button>
                <Link to="/app">
                  <s-button variant="tertiary">Back to products</s-button>
                </Link>
              </>
            ) : (
              <s-button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Next →
              </s-button>
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Workflow">
        <s-paragraph tone="subdued">
          Scene 1 & 3: image → remove BG → background → composite → Remotion video.
          Scene 2: image → remove BG → stock video → composite.
          Then optional audio & music, then merge.
        </s-paragraph>
        <s-unordered-list>
          {workflowSteps.map((s, i) => (
            <s-list-item
              key={i}
              style={{
                opacity: i === step ? 1 : i < step ? 0.8 : 0.5,
                fontWeight: i === step ? 600 : 400,
              }}
            >
              {i + 1}. {s.title}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
