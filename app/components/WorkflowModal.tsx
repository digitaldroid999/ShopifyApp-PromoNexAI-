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

export function WorkflowModal({
  onClose,
  isSample,
}: {
  onClose: () => void;
  isSample: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"scene1" | "scene2" | "scene3">("scene1");

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
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Create promo video</h2>
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

        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
            padding: "0 20px",
          }}
        >
          {(["scene1", "scene2", "scene3"] as const).map((tab) => (
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
              }}
            >
              {tab === "scene1" ? "Scene 1" : tab === "scene2" ? "Scene 2" : "Scene 3"}
            </button>
          ))}
        </div>

        <div style={{ padding: "20px", overflow: "auto", flex: 1 }}>
          {activeTab === "scene1" && <Scene1Content />}
          {activeTab === "scene2" && <Scene2Content />}
          {activeTab === "scene3" && <Scene3Content />}
        </div>
      </div>
    </div>
  );
}

function Scene1Content() {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>("s1");
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
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
    }, 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Select an image and remove its background.
          </p>
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Composite the subject with a generated or fetched background.
          </p>
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
                <button
                  type="button"
                  onClick={handleGenerateBg}
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
                  Generate / Fetch background
                </button>
              )}
            </div>
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Generate the scene video from the composited image.
          </p>
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

function Scene2Content() {
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
    }, 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Select an image and remove its background.
          </p>
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Fetch and select a stock video (Pexels / Pixabay / Coverr). No videos fetched yet — select a slot to enable Generate video.
          </p>
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

function Scene3Content() {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>("s1");
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [bgRemovedLoading, setBgRemovedLoading] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
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
    }, 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {step === 1 && (
        <>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Select an image and remove its background.
          </p>
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Composite the subject with a generated or fetched background (Scene 3 style).
          </p>
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
                <button
                  type="button"
                  onClick={handleGenerateBg}
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
                  Generate / Fetch background
                </button>
              )}
            </div>
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Generate the scene video (different Remotion style).
          </p>
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
