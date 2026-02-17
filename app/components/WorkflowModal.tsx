import { useState } from "react";

const BASE = "/mockup";

const productImages = [
  { id: "s1", src: `${BASE}/scene1-original.jpg`, label: "Image 1" },
  { id: "s2", src: `${BASE}/scene2-original.jpg`, label: "Image 2" },
  { id: "s3", src: `${BASE}/scene3-original.jpg`, label: "Image 3" },
];

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

const FETCH_SLOT_COUNT = 8;

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
  mockImageUrl,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  mockImageUrl: string;
}) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!open) return null;

  const handleSlotClick = (index: number) => {
    setSelectedSlot(index);
    onSelect(mockImageUrl);
    setTimeout(() => onClose(), 400);
  };

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
          maxWidth: "480px",
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
        <p style={{ margin: 0, padding: "12px 20px", fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
          Select a background from third-party platforms (mockup: empty slots; click a slot to use sample image).
        </p>
        <div
          style={{
            padding: "0 20px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            overflow: "auto",
          }}
        >
          {Array.from({ length: FETCH_SLOT_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSlotClick(i)}
              style={{
                aspectRatio: "1",
                padding: 0,
                border: selectedSlot === i ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid var(--p-color-border-secondary, #e1e3e5)",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selectedSlot === i ? (
                <img src={mockImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <span style={{ fontSize: "12px", color: "var(--p-color-text-subdued, #6d7175)" }}>Empty slot</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkflowModal({
  onClose,
  onDone,
  isSample,
}: {
  onClose: () => void;
  /** Called when user clicks Done after viewing the final video; pass the final video URL to add to product */
  onDone?: (videoUrl: string) => void;
  isSample: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"scene1" | "scene2" | "scene3">("scene1");
  const [scene1Complete, setScene1Complete] = useState(false);
  const [scene2Complete, setScene2Complete] = useState(false);
  const [scene3Complete, setScene3Complete] = useState(false);
  const [showingFinal, setShowingFinal] = useState(false);

  const allScenesComplete = scene1Complete && scene2Complete && scene3Complete;

  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

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
              <div style={{ display: activeTab === "scene1" ? "block" : "none" }}>
                <Scene1Content onComplete={() => setScene1Complete(true)} />
              </div>
              <div style={{ display: activeTab === "scene2" ? "block" : "none" }}>
                <Scene2Content onComplete={() => setScene2Complete(true)} />
              </div>
              <div style={{ display: activeTab === "scene3" ? "block" : "none" }}>
                <Scene3Content onComplete={() => setScene3Complete(true)} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Scene1Content({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>("s1");
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [composited, setComposited] = useState<string | null>(null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [sceneVideo, setSceneVideo] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const handleRemoveBg = () => {
    setBgRemovedLoading(true);
    setTimeout(() => {
      setBgRemoved(`${BASE}/scene1-bg removed.png`);
      setBgRemovedLoading(false);
    }, 1200);
  };

  const handleGenerateBg = () => {
    setBgLoading(true);
    setTimeout(() => {
      setBgImage(`${BASE}/scene1-bg.png`);
      setBgLoading(false);
    }, 1000);
  };

  const handleComposite = () => {
    setCompositeLoading(true);
    setTimeout(() => {
      setComposited(`${BASE}/scene1-composited.png`);
      setCompositeLoading(false);
    }, 1500);
  };

  const handleGenerateScene = () => {
    setSceneLoading(true);
    setTimeout(() => {
      setSceneVideo(`${BASE}/scene1-video.mp4`);
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
            total={3}
            title="Select image & remove background"
            description="Choose one of the product images below, then click Remove BG to strip the background. The result will be used as the subject for this scene."
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {productImages.map((img) => (
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
                <img src={img.src} alt={img.label} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
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
              ) : bgImage ? (
                <img src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleGenerateBg}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: "var(--p-color-bg-fill-info, #2c6ecb)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Generate background
                  </button>
                  <button
                    type="button"
                    onClick={() => setFetchModalOpen(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "1px dashed #8c9196",
                      background: "transparent",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "#2c6ecb",
                    }}
                  >
                    Fetch background
                  </button>
                </div>
              )}
            </div>
            <FetchBackgroundModal
              open={fetchModalOpen}
              onClose={() => setFetchModalOpen(false)}
              onSelect={(url) => setBgImage(url)}
              mockImageUrl={`${BASE}/scene1-bg.png`}
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
          {composited && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={composited} alt="Composited" style={{ width: "200px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
              <button
                type="button"
                onClick={() => setStep(3)}
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

function Scene2Content({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>("s1");
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [selectedVideoSlot, setSelectedVideoSlot] = useState<number | null>(null);
  const [sceneVideo, setSceneVideo] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const videoSlots = [1, 2, 3, 4, 5, 6];

  const handleRemoveBg = () => {
    setBgRemovedLoading(true);
    setTimeout(() => {
      setBgRemoved(`${BASE}/scene2-bg removed.png`);
      setBgRemovedLoading(false);
    }, 1200);
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
            {productImages.map((img) => (
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
                <img src={img.src} alt={img.label} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
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
            description="Pick a stock video from Pexels, Pixabay, or Coverr as the background. Then click Generate video to composite your subject onto it and create the scene (~8s)."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {videoSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedVideoSlot(slot)}
                style={{
                  ...boxStyle,
                  minHeight: "100px",
                  cursor: "pointer",
                  borderColor: selectedVideoSlot === slot ? "var(--p-color-border-info, #2c6ecb)" : undefined,
                  borderWidth: selectedVideoSlot === slot ? "2px" : "1px",
                }}
              >
                <span style={{ fontSize: "14px", color: "#6d7175" }}>Video slot {slot}</span>
              </button>
            ))}
          </div>
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
                disabled={selectedVideoSlot === null}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedVideoSlot === null ? "#9ca3af" : "var(--p-color-bg-fill-info, #2c6ecb)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: selectedVideoSlot === null ? "not-allowed" : "pointer",
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

function Scene3Content({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>("s1");
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [fetchModalOpen, setFetchModalOpen] = useState(false);
  const [composited, setComposited] = useState<string | null>(null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [sceneVideo, setSceneVideo] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const handleRemoveBg = () => {
    setBgRemovedLoading(true);
    setTimeout(() => {
      setBgRemoved(`${BASE}/scene3-bg removed.png`);
      setBgRemovedLoading(false);
    }, 1200);
  };

  const handleGenerateBg = () => {
    setBgLoading(true);
    setTimeout(() => {
      setBgImage(`${BASE}/scene3-bg.png`);
      setBgLoading(false);
    }, 1000);
  };

  const handleComposite = () => {
    setCompositeLoading(true);
    setTimeout(() => {
      setComposited(`${BASE}/scene3-compositied.png`);
      setCompositeLoading(false);
    }, 1500);
  };

  const handleGenerateScene = () => {
    setSceneLoading(true);
    setTimeout(() => {
      setSceneVideo(`${BASE}/scene3-video.mp4`);
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
            total={3}
            title="Select image & remove background"
            description="Choose one of the product images, then click Remove BG. The result will be used as the subject for this scene (same flow as Scene 1)."
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {productImages.map((img) => (
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
                <img src={img.src} alt={img.label} style={{ width: "120px", height: "120px", objectFit: "cover", display: "block" }} />
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
              ) : bgImage ? (
                <img src={bgImage} alt="Background" style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleGenerateBg}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "1px solid var(--p-color-border-secondary, #e1e3e5)",
                      background: "var(--p-color-bg-fill-info, #2c6ecb)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Generate background
                  </button>
                  <button
                    type="button"
                    onClick={() => setFetchModalOpen(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "1px dashed #8c9196",
                      background: "transparent",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "#2c6ecb",
                    }}
                  >
                    Fetch background
                  </button>
                </div>
              )}
            </div>
            <FetchBackgroundModal
              open={fetchModalOpen}
              onClose={() => setFetchModalOpen(false)}
              onSelect={(url) => setBgImage(url)}
              mockImageUrl={`${BASE}/scene3-bg.png`}
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
          {composited && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={composited} alt="Composited" style={{ width: "200px", height: "auto", borderRadius: "8px", border: "1px solid #e1e3e5" }} />
              <button
                type="button"
                onClick={() => setStep(3)}
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
