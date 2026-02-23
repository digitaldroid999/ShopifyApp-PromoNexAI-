import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { finalizeShortStart } from "../services/promonexai.server";

const LOG = "[API merge/finalize]";

/** POST /app/api/merge/finalize — start finalize (merge) for a short via BACKEND_URL/merge/finalize */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body: { short_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const shortId = typeof body.short_id === "string" ? body.short_id.trim() : "";
  if (!shortId) {
    return Response.json({ error: "short_id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const short = await (prisma as any).short.findUnique({
    where: { id: shortId },
    select: { id: true, userId: true },
  });
  if (!short) {
    return Response.json({ error: "Short not found" }, { status: 404 });
  }
  const userId = short.userId ?? "";
  if (!userId) {
    return Response.json({ error: "Short has no user_id; cannot finalize" }, { status: 400 });
  }

  const result = await finalizeShortStart(userId, short.id);
  if (!result.ok) {
    console.log(`${LOG} Backend error:`, result.error);
    return Response.json({ error: result.error }, { status: 400 });
  }
  console.log(`${LOG} Started finalize task_id=${result.task_id} short_id=${shortId}`);
  return Response.json({
    task_id: result.task_id,
    status: result.status,
    short_id: result.short_id,
    user_id: result.user_id,
    message: result.message ?? "Finalization task started",
  });
};
