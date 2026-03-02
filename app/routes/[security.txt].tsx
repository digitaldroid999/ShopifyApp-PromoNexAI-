import type { LoaderFunctionArgs } from "react-router";

const SECURITY_TXT = `Contact: mailto:security@promonexai.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://shopify.promonexai.com/.well-known/security.txt
`;

export async function loader({ request }: LoaderFunctionArgs) {
  return new Response(SECURITY_TXT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
