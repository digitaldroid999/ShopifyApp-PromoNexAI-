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
    return Response.json({ shortId: null, userId: null, status: null, scene1Id: null, scene2Id: null, scene3Id: null, scene1Status: null, scene2Status: null, scene3Status: null, audioInfo: null, bgMusic: null, scene1FetchedMedia: null, scene2FetchedMedia: null, scene3FetchedMedia: null, scene1BgRemovedUrl: null, scene2BgRemovedUrl: null, scene3BgRemovedUrl: null, scene1GeneratedVideoUrl: null, scene2GeneratedVideoUrl: null, scene3GeneratedVideoUrl: null, finalVideoUrl: null });
  }
  // When loading a short that is still draft, mark as in_progress (user is working on it)
  const currentStatus = (short as { status?: string }).status?.trim() || "draft";
  if (currentStatus === "draft") {
    try {
      await shortDelegate.update({
        where: { id: short.id },
        data: { status: "in_progress" },
      });
    } catch {
      // ignore
    }
  }
  const resolvedStatus = currentStatus === "draft" ? "in_progress" : currentStatus;
  const [s1, s2, s3] = short.scenes;
  const sceneStatus = (s: { status?: string } | undefined) => (s?.status?.trim() || "step1");
  const sceneFetchedMedia = (s: { fetchedMedia?: unknown } | undefined) => (s?.fetchedMedia != null ? s.fetchedMedia : null);
  const audioInfo = (short as { audioInfo?: { voiceId: string | null; voiceName: string | null; audioScript: string | null; generatedAudioUrl: string | null; subtitles: unknown } | null }).audioInfo;
  const metadata = short.metadata as {
    bgMusic?: {
      id?: string | null;
      name?: string | null;
      title?: string | null;
      genre?: string | null;
      duration?: number | null;
      previewUrl?: string | null;
      preview_url?: string | null;
      downloadUrl?: string | null;
    } | null;
  } | null;
  const bgMusic = metadata?.bgMusic ?? null;
  const sceneWithUrl = (s: { generatedVideoUrl?: string | null } | undefined) => (s?.generatedVideoUrl?.trim() ? s.generatedVideoUrl : null) ?? null;
  const sceneImageUrl = (s: { imageUrl?: string | null } | undefined) => (s?.imageUrl?.trim() ? s.imageUrl : null) ?? null;
  const sceneBgRemovedUrl = (s: { metadata?: unknown } | undefined) => {
    const m = s?.metadata;
    if (m && typeof m === "object" && m !== null && "bgRemovedUrl" in m) {
      const v = (m as { bgRemovedUrl?: string }).bgRemovedUrl;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return null;
  };
  const finalVideoUrl = (short as { finalVideoUrl?: string | null }).finalVideoUrl?.trim() || null;
  const bgMusicPayload = bgMusic && typeof bgMusic === "object"
    ? {
        id: bgMusic.id ?? null,
        name: bgMusic.name ?? bgMusic.title ?? null,
        genre: bgMusic.genre ?? "Storyblocks",
        duration: typeof bgMusic.duration === "number" ? bgMusic.duration : null,
        previewUrl: bgMusic.previewUrl ?? bgMusic.preview_url ?? null,
        downloadUrl: bgMusic.downloadUrl ?? bgMusic.previewUrl ?? bgMusic.preview_url ?? null,
      }
    : null;
  return Response.json({
    shortId: short.id,
    userId: short.userId ?? null,
    status: resolvedStatus,
    scene1Id: s1?.id ?? null,
    scene2Id: s2?.id ?? null,
    scene3Id: s3?.id ?? null,
    scene1Status: sceneStatus(s1),
    scene2Status: sceneStatus(s2),
    scene3Status: sceneStatus(s3),
    scene1ImageUrl: sceneImageUrl(s1),
    scene2ImageUrl: sceneImageUrl(s2),
    scene3ImageUrl: sceneImageUrl(s3),
    scene1FetchedMedia: sceneFetchedMedia(s1),
    scene2FetchedMedia: sceneFetchedMedia(s2),
    scene3FetchedMedia: sceneFetchedMedia(s3),
    scene1BgRemovedUrl: sceneBgRemovedUrl(s1),
    scene2BgRemovedUrl: sceneBgRemovedUrl(s2),
    scene3BgRemovedUrl: sceneBgRemovedUrl(s3),
    scene1GeneratedVideoUrl: sceneWithUrl(s1),
    scene2GeneratedVideoUrl: sceneWithUrl(s2),
    scene3GeneratedVideoUrl: sceneWithUrl(s3),
    finalVideoUrl,
    audioInfo: audioInfo
      ? {
          voiceId: audioInfo.voiceId ?? null,
          voiceName: audioInfo.voiceName ?? null,
          audioScript: audioInfo.audioScript ?? null,
          generatedAudioUrl: audioInfo.generatedAudioUrl ?? null,
          subtitles: audioInfo.subtitles ?? null,
        }
      : null,
    bgMusic: bgMusicPayload,
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
      const sceneImageUrl = (s: { imageUrl?: string | null } | undefined) => (s?.imageUrl?.trim() ? s.imageUrl : null) ?? null;
      const sceneFetchedMediaExisting = (s: { fetchedMedia?: unknown } | undefined) => (s?.fetchedMedia != null ? s.fetchedMedia : null);
      const sceneBgRemovedUrlExisting = (s: { metadata?: unknown } | undefined) => {
        const m = s?.metadata;
        if (m && typeof m === "object" && m !== null && "bgRemovedUrl" in m) {
          const v = (m as { bgRemovedUrl?: string }).bgRemovedUrl;
          return typeof v === "string" && v.trim() ? v.trim() : null;
        }
        return null;
      };
      const meta = existing.metadata as {
        bgMusic?: {
          id?: string | null;
          name?: string | null;
          title?: string | null;
          genre?: string | null;
          duration?: number | null;
          previewUrl?: string | null;
          preview_url?: string | null;
          downloadUrl?: string | null;
        } | null;
      } | null;
      const bgMusicExisting = meta?.bgMusic ?? null;
      const bgMusicPayload = bgMusicExisting && typeof bgMusicExisting === "object"
        ? {
            id: bgMusicExisting.id ?? null,
            name: bgMusicExisting.name ?? bgMusicExisting.title ?? null,
            genre: bgMusicExisting.genre ?? "Storyblocks",
            duration: typeof bgMusicExisting.duration === "number" ? bgMusicExisting.duration : null,
            previewUrl: bgMusicExisting.previewUrl ?? bgMusicExisting.preview_url ?? null,
            downloadUrl: bgMusicExisting.downloadUrl ?? bgMusicExisting.previewUrl ?? bgMusicExisting.preview_url ?? null,
          }
        : null;
      const sceneStatusExisting = (s: { status?: string } | undefined) => (s?.status?.trim() || "step1");
      return Response.json({
        shortId: existing.id,
        userId: existing.userId ?? null,
        status: (existing as { status?: string }).status ?? "draft",
        scene1Id: s1?.id ?? null,
        scene2Id: s2?.id ?? null,
        scene3Id: s3?.id ?? null,
        scene1Status: sceneStatusExisting(s1),
        scene2Status: sceneStatusExisting(s2),
        scene3Status: sceneStatusExisting(s3),
        scene1ImageUrl: sceneImageUrl(s1),
        scene2ImageUrl: sceneImageUrl(s2),
        scene3ImageUrl: sceneImageUrl(s3),
        scene1FetchedMedia: sceneFetchedMediaExisting(s1),
        scene2FetchedMedia: sceneFetchedMediaExisting(s2),
        scene3FetchedMedia: sceneFetchedMediaExisting(s3),
        scene1BgRemovedUrl: sceneBgRemovedUrlExisting(s1),
        scene2BgRemovedUrl: sceneBgRemovedUrlExisting(s2),
        scene3BgRemovedUrl: sceneBgRemovedUrlExisting(s3),
        scene1GeneratedVideoUrl: sceneWithUrl(s1),
        scene2GeneratedVideoUrl: sceneWithUrl(s2),
        scene3GeneratedVideoUrl: sceneWithUrl(s3),
        audioInfo: audioInfo
          ? { voiceId: audioInfo.voiceId ?? null, voiceName: audioInfo.voiceName ?? null, audioScript: audioInfo.audioScript ?? null, generatedAudioUrl: audioInfo.generatedAudioUrl ?? null, subtitles: audioInfo.subtitles ?? null }
          : null,
        bgMusic: bgMusicPayload,
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
          status: "step1",
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
