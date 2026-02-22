import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/** GET ?productId=xxx → short + scene ids from DB (for modal open) */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim();
  if (!productId) {
    return Response.json({ error: "productId required" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortDelegate = (prisma as any).short;
  const short = await shortDelegate.findUnique({
    where: { productId },
    include: {
      scenes: { orderBy: { sceneNumber: "asc" } },
      audioInfo: true,
    },
  });
  if (!short) {
    return Response.json({ shortId: null, userId: null, scene1Id: null, scene2Id: null, scene3Id: null, audioInfo: null, scene1GeneratedVideoUrl: null, scene2GeneratedVideoUrl: null, scene3GeneratedVideoUrl: null });
  }
  const [s1, s2, s3] = short.scenes;
  const audioInfo = (short as { audioInfo?: { voiceId: string | null; voiceName: string | null; audioScript: string | null; generatedAudioUrl: string | null; subtitles: unknown } | null }).audioInfo;
  const sceneWithUrl = (s: { generatedVideoUrl?: string | null } | undefined) => (s?.generatedVideoUrl?.trim() ? s.generatedVideoUrl : null) ?? null;
  return Response.json({
    shortId: short.id,
    userId: short.userId ?? null,
    scene1Id: s1?.id ?? null,
    scene2Id: s2?.id ?? null,
    scene3Id: s3?.id ?? null,
    scene1GeneratedVideoUrl: sceneWithUrl(s1),
    scene2GeneratedVideoUrl: sceneWithUrl(s2),
    scene3GeneratedVideoUrl: sceneWithUrl(s3),
    audioInfo: audioInfo
      ? {
          voiceId: audioInfo.voiceId ?? null,
          voiceName: audioInfo.voiceName ?? null,
          audioScript: audioInfo.audioScript ?? null,
          generatedAudioUrl: audioInfo.generatedAudioUrl ?? null,
          subtitles: audioInfo.subtitles ?? null,
        }
      : null,
  });
};

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

  const shop = (session as { shop?: string }).shop?.trim() || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortDelegate = (prisma as any).short;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoScene = (prisma as any).videoScene;
  const DEFAULT_DURATION_SEC = 8;

  if (productId) {
    const existing = await shortDelegate.findUnique({
      where: { productId },
      include: { scenes: { orderBy: { sceneNumber: "asc" } }, audioInfo: true },
    });
    if (existing) {
      const [s1, s2, s3] = existing.scenes;
      const audioInfo = (existing as { audioInfo?: { voiceId: string | null; voiceName: string | null; audioScript: string | null; generatedAudioUrl: string | null; subtitles: unknown } | null }).audioInfo;
      const sceneWithUrl = (s: { generatedVideoUrl?: string | null } | undefined) => (s?.generatedVideoUrl?.trim() ? s.generatedVideoUrl : null) ?? null;
      return Response.json({
        shortId: existing.id,
        userId: existing.userId ?? null,
        scene1Id: s1?.id ?? null,
        scene2Id: s2?.id ?? null,
        scene3Id: s3?.id ?? null,
        scene1GeneratedVideoUrl: sceneWithUrl(s1),
        scene2GeneratedVideoUrl: sceneWithUrl(s2),
        scene3GeneratedVideoUrl: sceneWithUrl(s3),
        audioInfo: audioInfo
          ? { voiceId: audioInfo.voiceId ?? null, voiceName: audioInfo.voiceName ?? null, audioScript: audioInfo.audioScript ?? null, generatedAudioUrl: audioInfo.generatedAudioUrl ?? null, subtitles: audioInfo.subtitles ?? null }
          : null,
      });
    }
  }

  const short = await shortDelegate.create({
    data: {
      title,
      productId: productId ?? undefined,
      userId: shop,
      status: "draft",
    },
  });

  const sceneIds: string[] = [];
  try {
    for (let sceneNumber = 1; sceneNumber <= 3; sceneNumber++) {
      const scene = await videoScene.create({
        data: {
          shortId: short.id,
          sceneNumber,
          duration: DEFAULT_DURATION_SEC,
          status: "pending",
        },
      });
      sceneIds.push(scene.id);
    }
  } catch (err) {
    console.error("[app.api.shorts] VideoScene create failed:", err);
  }

  return Response.json({
    shortId: short.id,
    userId: short.userId ?? null,
    scene1Id: sceneIds[0] ?? null,
    scene2Id: sceneIds[1] ?? null,
    scene3Id: sceneIds[2] ?? null,
  });
};
