import { useState, useRef, useCallback, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  LEGAL_DOCUMENTS,
  isDocumentWithSections,
  type LegalSection,
} from "../lib/legal-content";

const LEGAL_AGREE_API = "/app/api/legal/agree";

type TabId = "terms" | "privacy" | "dataProcessing";

const TABS: { id: TabId; label: string }[] = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "dataProcessing", label: "Data Processing Agreement" },
];

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
  marginTop: "8px",
  marginBottom: "16px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "2px solid var(--p-color-border-secondary, #e1e3e5)",
  background: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
};

function renderLegalContent(tabId: TabId) {
  const doc = LEGAL_DOCUMENTS[tabId];
  if (isDocumentWithSections(doc)) {
    return doc.sections.map((sec: LegalSection, i: number) =>
      sec.type === "text" ? (
        <div key={i} style={{ whiteSpace: "pre-wrap", marginBottom: "12px" }}>
          {sec.content}
        </div>
      ) : (
        <table key={i} style={tableStyle}>
          <thead>
            <tr>
              {sec.headers.map((h, j) => (
                <th key={j} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sec.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={tdStyle}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    );
  }
  return doc.content;
}

export function LegalModal({
  open,
  onAgree,
  isUpdatedTerms = false,
}: {
  open: boolean;
  onAgree: () => void;
  isUpdatedTerms?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("terms");
  const [scrolledTabs, setScrolledTabs] = useState<Set<TabId>>(new Set());
  const scrollRefs = useRef<Record<TabId, HTMLDivElement | null>>({
    terms: null,
    privacy: null,
    dataProcessing: null,
  });

  const agreeFetcher = useFetcher<{ success?: boolean; termsVersion?: string }>();

  const checkScroll = useCallback((tab: TabId, el: HTMLDivElement | null) => {
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollHeight - clientHeight <= scrollTop + 20;
    if (atBottom) {
      setScrolledTabs((prev) => new Set(prev).add(tab));
    }
  }, []);

  const handleScroll = useCallback(
    (tab: TabId) => () => {
      const el = scrollRefs.current[tab];
      checkScroll(tab, el);
    },
    [checkScroll],
  );

  const currentScrollEl = scrollRefs.current[activeTab];
  useEffect(() => {
    if (!open) return;
    setScrolledTabs(new Set());
  }, [open]);

  useEffect(() => {
    if (!open || !currentScrollEl) return;
    checkScroll(activeTab, currentScrollEl);
  }, [open, activeTab, currentScrollEl, checkScroll]);

  const allTabsScrolled = TABS.every((t) => scrolledTabs.has(t.id));
  const hasScrolledToBottom = allTabsScrolled;

  const handleAgree = () => {
    agreeFetcher.submit({}, { method: "POST", action: LEGAL_AGREE_API });
  };

  useEffect(() => {
    if (agreeFetcher.data?.success) {
      onAgree();
    }
  }, [agreeFetcher.data, onAgree]);

  if (!open) return null;

  const canAgree = hasScrolledToBottom && agreeFetcher.state !== "submitting";

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  };

  const modalStyle: React.CSSProperties = {
    background: "var(--p-color-bg-surface, #fff)",
    borderRadius: "12px",
    boxShadow: "var(--p-shadow-modal, 0 8px 32px rgba(0,0,0,0.12))",
    maxWidth: "560px",
    width: "100%",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid var(--p-color-border-secondary, #e1e3e5)",
    padding: "0 16px",
    gap: "4px",
    flexShrink: 0,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "12px 16px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: active ? 600 : 400,
    color: active
      ? "var(--p-color-text-primary, #202223)"
      : "var(--p-color-text-subdued, #6d7175)",
    borderBottom: active ? "2px solid var(--p-color-border-info, #2c6ecb)" : "2px solid transparent",
    marginBottom: "-1px",
  });

  const contentAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    minHeight: "280px",
    maxHeight: "50vh",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--p-color-text-primary, #202223)",
    whiteSpace: "pre-wrap",
  };

  const footerStyle: React.CSSProperties = {
    padding: "16px",
    borderTop: "1px solid var(--p-color-border-secondary, #e1e3e5)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
          <h2 id="legal-modal-title" style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {isUpdatedTerms ? "Updated legal documents" : "Legal agreement"}
          </h2>
          {isUpdatedTerms && (
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--p-color-text-subdued, #6d7175)" }}>
              Our terms, privacy policy, or data processing agreement have been updated. Please review and accept to continue.
            </p>
          )}
        </div>

        <div style={tabBarStyle}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={tabStyle(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {TABS.map((tab) => (
            <div
              key={tab.id}
              ref={(el) => {
                scrollRefs.current[tab.id] = el;
              }}
              style={{
                ...contentAreaStyle,
                display: activeTab === tab.id ? "block" : "none",
              }}
              onScroll={handleScroll(tab.id)}
            >
              {renderLegalContent(tab.id)}
            </div>
          ))}
        </div>

        <div style={footerStyle}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--p-color-text-subdued, #6d7175)" }}>
            Scroll to the bottom of each tab, then click &quot;I Agree&quot; to continue.
          </p>
          <s-button
            variant="primary"
            disabled={!canAgree}
            onClick={handleAgree}
            {...(agreeFetcher.state === "submitting" ? { loading: true } : {})}
          >
            I Agree
          </s-button>
        </div>
      </div>
    </div>
  );
}
