import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  getScene13PreviousStatus,
  getScene2PreviousStatus,
  getScene13ClearFieldsWhenGoingPrevious,
  getScene2ClearFieldsWhenGoingPrevious,
  SCENE13_STATUSES,
  SCENE2_STATUSES,
} from "../services/sceneStatus.server";

const DEFAULT_DURATION_SEC = 8;

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  // PATCH: update scene imageUrl, status, fetchedMedia, reset, or goPrevious (clear current step data and set previous status)
  if (request.method === "PATCH") {
    let body: { sceneId?: string; imageUrl?: string; reset?: boolean; status?: string; goPrevious?: boolean; fetchedMedia?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const sceneId = body.sceneId?.trim();
    if (!sceneId) {
      return Response.json({ error: "sceneId required" }, { status: 400 });
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoScene = (prisma as any).videoScene;
      if (body.reset === true) {
        await videoScene.update({
          where: { id: sceneId },
          data: {
            imageUrl: null,
            generatedVideoUrl: null,
            fetchedMedia: null,
            status: "step1",
          },
        });
        return Response.json({ ok: true, reset: true });
      }
      if (body.goPrevious === true) {
        const scene = await videoScene.findUnique({ where: { id: sceneId }, select: { sceneNumber: true, status: true } });
        if (!scene) {
          return Response.json({ error: "Scene not found" }, { status: 404 });
        }
        const currentStatus = (scene.status?.trim() || "step1") as string;
        const sceneNumber = scene.sceneNumber as 1 | 2 | 3;
        const prevStatus: string | null =
          sceneNumber === 2
            ? getScene2PreviousStatus(currentStatus)
            : getScene13PreviousStatus(currentStatus);
        if (!prevStatus) {
          return Response.json({ ok: true, status: currentStatus, goPrevious: false, message: "Already at first step" });
        }
        const clearFields =
          sceneNumber === 2
            ? getScene2ClearFieldsWhenGoingPrevious(currentStatus)
            : getScene13ClearFieldsWhenGoingPrevious(currentStatus);
        const data: { status: string; imageUrl?: null; generatedVideoUrl?: null; fetchedMedia?: null } = { status: prevStatus };
        if (clearFields.imageUrl) data.imageUrl = null;
        if (clearFields.generatedVideoUrl) data.generatedVideoUrl = null;
        if (clearFields.fetchedMedia) data.fetchedMedia = null;
        await videoScene.update({ where: { id: sceneId }, data });
        return Response.json({ ok: true, status: prevStatus, goPrevious: true });
      }
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined;
      const status =
        typeof body.status === "string" && body.status.trim()
          ? body.status.trim()
          : undefined;
      const fetchedMedia = body.fetchedMedia;
      const validScene13 = status && SCENE13_STATUSES.includes(status as never);
      const validScene2 = status && SCENE2_STATUSES.includes(status as never);
      const data: { imageUrl?: string | null; status?: string; fetchedMedia?: unknown } = {};
      if (imageUrl !== undefined) data.imageUrl = imageUrl ?? null;
      if (status && (validScene13 || validScene2)) data.status = status;
      if (fetchedMedia !== undefined) data.fetchedMedia = fetchedMedia === null ? null : fetchedMedia;
      if (Object.keys(data).length === 0) {
        return Response.json({ ok: true });
      }
      await videoScene.update({
        where: { id: sceneId },
        data,
      });
      return Response.json({ ok: true, ...(data.status ? { status: data.status } : {}) });
    } catch (err) {
      console.error("[app.api.shorts.scenes] VideoScene update failed:", err);
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to update scene" },
        { status: 500 }
      );
    }
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let shortId: string | undefined;
  let sceneNumber: number | undefined;

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    let body: { shortId?: string; sceneNumber?: number };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    shortId = body.shortId?.trim();
    const rawScene = body.sceneNumber;
    sceneNumber =
      typeof rawScene === "number"
        ? rawScene
        : typeof rawScene === "string"
          ? parseInt(rawScene, 10)
          : undefined;
  } else {
    const formData = await request.formData();
    shortId = (formData.get("shortId") ?? formData.get("short_id"))?.toString()?.trim();
    const rawScene = formData.get("sceneNumber") ?? formData.get("scene_number");
    sceneNumber =
      typeof rawScene === "number"
        ? rawScene
        : rawScene != null
          ? parseInt(String(rawScene), 10)
          : undefined;
  }

  if (!shortId) {
    return Response.json({ error: "shortId required" }, { status: 400 });
  }
  if (sceneNumber === undefined || Number.isNaN(sceneNumber) || sceneNumber < 1 || sceneNumber > 3) {
    return Response.json({ error: "sceneNumber must be 1, 2, or 3" }, { status: 400 });
  }

  console.log("[app.api.shorts.scenes] ensure scene:", { shortId, sceneNumber });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoScene = (prisma as any).videoScene;
    const existing = await videoScene.findFirst({
      where: { shortId, sceneNumber },
    });

    if (existing) {
      return Response.json({ sceneId: existing.id, created: false });
    }

    const scene = await videoScene.create({
      data: {
        shortId,
        sceneNumber,
        duration: DEFAULT_DURATION_SEC,
        status: "step1",
      },
    });
    return Response.json({ sceneId: scene.id, created: true });
  } catch (err) {
    console.error("[app.api.shorts.scenes] VideoScene create failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create scene" },
      { status: 500 }
    );
  }
};

// No default export = resource route (action response returned as JSON, not HTML document).
