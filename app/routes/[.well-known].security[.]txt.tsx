import type { LoaderFunctionArgs } from "react-router";

function getSecurityTxt(): string {
  const baseUrl =
    process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") || "https://sa.promonexai.com";
  return `Contact: mailto:security@promonexai.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: ${baseUrl}/.well-known/security.txt
`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response(getSecurityTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
