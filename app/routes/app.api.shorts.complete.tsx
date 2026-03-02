import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { deleteWorkflowTemp } from "../services/workflowTemp.server";

/**
 * POST — mark short as completed and remove workflow temp for the product.
 * Body: { shortId: string, productId: string }
 * - Short.status = "completed" (user clicked Complete; they can only restart from scratch after this)
 * - Deletes promo_workflow_temp row for (shop, productId)
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { shortId?: string; productId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shortId = typeof body.shortId === "string" ? body.shortId.trim() : "";
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const shop = (session as { shop?: string }).shop?.trim() ?? "";

  if (!shortId) {
    return Response.json({ error: "shortId is required" }, { status: 400 });
  }
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }

  try {
    const short = await (prisma as any).short.findUnique({
      where: { id: shortId },
      select: { id: true },
    });
    if (!short) {
      return Response.json({ error: "Short not found" }, { status: 404 });
    }

    await (prisma as any).short.update({
      where: { id: shortId },
      data: { status: "completed" },
    });

    await deleteWorkflowTemp(shop, productId);

    return Response.json({ success: true, status: "completed" });
  } catch (e) {
    console.error("[app.api.shorts.complete]", e);
    return Response.json({ error: "Failed to complete short" }, { status: 500 });
  }
};
