import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordLegalAgreement, TERMS_VERSION } from "../lib/legal.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const { session } = await authenticate.admin(request);
  await recordLegalAgreement(session.shop);
  return Response.json({
    success: true,
    termsVersion: TERMS_VERSION,
  });
};
