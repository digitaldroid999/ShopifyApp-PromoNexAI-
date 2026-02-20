import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { startShopifyVideo } from "../services/remotion.server";

const LOG_PREFIX = "[Remotion Start API]";
const DEFAULT_TEMPLATE = "product-modern-v1";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: {
    shortId?: string;
    sceneId?: string;
    imageUrl?: string;
    template?: string;
    product?: { name?: string; price?: string; rating?: number };
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shortId = body.shortId?.trim();
  const sceneId = body.sceneId?.trim();
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const template = typeof body.template === "string" && body.template.trim() ? body.template.trim() : DEFAULT_TEMPLATE;
  const product = body.product;
  const name = typeof product?.name === "string" ? product.name.trim() : "Product";
  const price = typeof product?.price === "string" ? product.price : "$0.00";
  const rating = typeof product?.rating === "number" ? product.rating : 0;

  if (!shortId) {
    return Response.json({ error: "shortId required" }, { status: 400 });
  }
  if (!imageUrl) {
    return Response.json({ error: "imageUrl required" }, { status: 400 });
  }

  const user_id = session?.shop ?? "anonymous";

  const result = await startShopifyVideo({
    template,
    imageUrl,
    product: { name, price, rating },
    user_id,
    short_id: shortId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task = await (prisma as any).task.create({
      data: {
        remotionTaskId: result.taskId,
        shortId,
        videoSceneId: sceneId || null,
        status: "pending",
        stage: "queued",
        progress: 0,
        metadata: { template, product: { name, price, rating }, imageUrl },
      },
    });
    return Response.json(
      { taskId: task.id, remotionTaskId: result.taskId, status: "pending" },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`${LOG_PREFIX} Task create failed:`, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 500 }
    );
  }
};

// No default export = resource route.
