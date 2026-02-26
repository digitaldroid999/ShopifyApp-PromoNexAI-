import { Link } from "react-router";
import { LEGAL_DOCUMENTS } from "../lib/legal-content";

export default function LegalTermsPage() {
  const { title, content } = LEGAL_DOCUMENTS.terms;
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px", fontFamily: "var(--p-font-family-sans, system-ui, sans-serif)" }}>
      <p style={{ marginBottom: "16px" }}>
        <Link to="/app" style={{ color: "var(--p-color-text-link, #2c6ecb)", textDecoration: "none" }}>
          ← Back to app
        </Link>
      </p>
      <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "16px" }}>{title}</h1>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "14px", color: "#202223" }}>
        {content}
      </div>
      <p style={{ marginTop: "24px" }}>
        <Link to="/app" style={{ color: "var(--p-color-text-link, #2c6ecb)", textDecoration: "none" }}>
          ← Back to app
        </Link>
      </p>
    </div>
  );
}
