import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { title?: string; productId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Promo video";
  const productId = typeof body.productId === "string" ? body.productId.trim() || undefined : undefined;

  // Use Shopify user ID from session (stored in DB when user authenticated)
  const sess = session as { id?: string } | undefined;
  let userId: bigint | null = null;
  if (sess?.id) {
    const row = await prisma.session.findUnique({
      where: { id: sess.id },
      select: { userId: true },
    });
    if (row?.userId != null) userId = row.userId;
  }
  if (userId == null) {
    const raw = (session as unknown as { userId?: string | number }).userId;
    if (raw != null) userId = BigInt(Number(raw));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortDelegate = (prisma as any).short;
  if (productId) {
    const existing = await shortDelegate.findUnique({
      where: { productId },
    });
    if (existing) {
      return Response.json({ shortId: existing.id });
    }
  }

  const short = await shortDelegate.create({
    data: {
      title,
      productId: productId ?? undefined,
      userId,
      status: "draft",
    },
  });

  // Create 3 VideoScene rows (scene_number 1, 2, 3) for this short
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoScene = (prisma as any).videoScene;
  const DEFAULT_DURATION_SEC = 8;
  for (let sceneNumber = 1; sceneNumber <= 3; sceneNumber++) {
    await videoScene.create({
      data: {
        shortId: short.id,
        sceneNumber,
        duration: DEFAULT_DURATION_SEC,
        status: "pending",
      },
    });
  }

  return Response.json({ shortId: short.id });
};

export default function ApiShortsRoute() {
  return null;
}
