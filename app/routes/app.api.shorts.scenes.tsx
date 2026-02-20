import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DEFAULT_DURATION_SEC = 8;

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { shortId?: string; sceneNumber?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shortId = body.shortId?.trim();
  const sceneNumber = typeof body.sceneNumber === "number" ? body.sceneNumber : undefined;

  if (!shortId) {
    return Response.json({ error: "shortId required" }, { status: 400 });
  }
  if (sceneNumber === undefined || sceneNumber < 1 || sceneNumber > 3) {
    return Response.json({ error: "sceneNumber must be 1, 2, or 3" }, { status: 400 });
  }

  const existing = await prisma.videoScene.findFirst({
    where: { shortId, sceneNumber },
  });

  if (existing) {
    return Response.json({ sceneId: existing.id, created: false });
  }

  const scene = await prisma.videoScene.create({
    data: {
      shortId,
      sceneNumber,
      duration: DEFAULT_DURATION_SEC,
      status: "pending",
    },
  });

  return Response.json({ sceneId: scene.id, created: true });
};

export default function ApiShortsScenesRoute() {
  return null;
}
