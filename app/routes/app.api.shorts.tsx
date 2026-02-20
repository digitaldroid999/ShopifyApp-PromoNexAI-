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
  const metadata = body.productId ? { productId: body.productId } : undefined;

  const sess = session as { userId?: string | number } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const short = await (prisma as any).short.create({
    data: {
      title,
      userId: sess?.userId != null ? BigInt(Number(sess.userId)) : null,
      status: "draft",
      metadata: metadata ?? undefined,
    },
  });

  return Response.json({ shortId: short.id });
};

export default function ApiShortsRoute() {
  return null;
}
