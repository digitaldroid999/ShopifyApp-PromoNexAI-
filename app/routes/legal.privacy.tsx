import { Link } from "react-router";
import {
  LEGAL_DOCUMENTS,
  isDocumentWithSections,
  type LegalSection,
} from "../lib/legal-content";

const textBlockStyle = {
  whiteSpace: "pre-wrap" as const,
  lineHeight: 1.6,
  fontSize: "14px",
  color: "#202223",
  marginBottom: "16px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  marginTop: "8px",
  marginBottom: "20px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid #e1e3e5",
  background: "#f6f6f7",
  fontWeight: 600,
  color: "#202223",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e1e3e5",
  color: "#202223",
};

export default function LegalPrivacyPage() {
  const doc = LEGAL_DOCUMENTS.privacy;
  if (!isDocumentWithSections(doc)) {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "var(--p-font-family-sans, system-ui, sans-serif)",
      }}
    >
      <p style={{ marginBottom: "16px" }}>
        <Link
          to="/app"
          style={{ color: "var(--p-color-text-link, #2c6ecb)", textDecoration: "none" }}
        >
          ← Back to app
        </Link>
      </p>
      <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "16px" }}>{doc.title}</h1>
      {doc.sections.map((sec: LegalSection, i: number) =>
        sec.type === "text" ? (
          <div key={i} style={textBlockStyle}>
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
      )}
      <p style={{ marginTop: "24px" }}>
        <Link
          to="/app"
          style={{ color: "var(--p-color-text-link, #2c6ecb)", textDecoration: "none" }}
        >
          ← Back to app
        </Link>
      </p>
    </div>
  );
}
