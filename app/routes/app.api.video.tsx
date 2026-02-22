import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { removeBackground, mergeVideoStart } from "../services/promonexai.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: {
    step?: string;
    imageUrl?: string;
    product_image_url?: string;
    background_video_url?: string;
    scene_id?: string;
    user_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const step = body.step;
  if (step === "removeBg") {
    const imageUrl = body.imageUrl;
    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ ok: false, error: "Missing or invalid imageUrl" }, { status: 400 });
    }
    const result = await removeBackground(imageUrl);
    return Response.json(result);
  }

  if (step === "mergeVideo") {
    const product_image_url = body.product_image_url;
    const background_video_url = body.background_video_url;
    const scene_id = body.scene_id;
    const user_id = body.user_id ?? "anonymous";
    const LOG = "[app.api.video] [Scene2 start]";
    console.log(`${LOG} request: scene_id=${scene_id} user_id=${user_id} product_image_url=${product_image_url?.slice(0, 60)}... background_video_url=${background_video_url?.slice(0, 60)}...`);

    if (!product_image_url || typeof product_image_url !== "string") {
      return Response.json({ error: "Missing or invalid product_image_url" }, { status: 400 });
    }
    if (!background_video_url || typeof background_video_url !== "string") {
      return Response.json({ error: "Missing or invalid background_video_url" }, { status: 400 });
    }
    if (!scene_id || typeof scene_id !== "string") {
      return Response.json({ error: "Missing or invalid scene_id" }, { status: 400 });
    }

    // Ensure scene exists so we have shortId for Task (required FK)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;
    const scene = await prismaAny.videoScene.findUnique({ where: { id: scene_id }, select: { shortId: true } });
    if (!scene?.shortId) {
      console.warn(`${LOG} Scene not found or missing shortId: scene_id=${scene_id}`);
      return Response.json({ error: "Scene not found. Please reopen the workflow and try again." }, { status: 400 });
    }
    const shortId = scene.shortId;

    console.log(`${LOG} Calling backend merge-video/start...`);
    const result = await mergeVideoStart(product_image_url, background_video_url, scene_id, user_id);
    if (!result.ok) {
      console.warn(`${LOG} Backend start failed: ${result.error}`);
      return Response.json({ error: result.error }, { status: 200 });
    }
    console.log(`${LOG} Backend returned task_id=${result.task_id} status=${result.status}`);

    try {
      const task = await prismaAny.task.create({
        data: {
          remotionTaskId: result.task_id,
          shortId,
          videoSceneId: scene_id,
          status: "pending",
          stage: "scene2_merge",
          progress: 0,
          metadata: { type: "scene2_merge" },
        },
      });
      console.log(`${LOG} Task created: id=${task.id} remotionTaskId=${result.task_id}`);
      return Response.json({ taskId: task.id, status: "pending" });
    } catch (err) {
      console.error(`${LOG} Failed to create Task:`, err);
      return Response.json({ error: "Failed to create task" }, { status: 500 });
    }
  }

  return Response.json({ ok: false, error: `Unknown step: ${step}` }, { status: 400 });
};

// No default export = resource route. POST returns the action JSON only, not the HTML document.
