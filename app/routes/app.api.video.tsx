import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { removeBackground, mergeVideo } from "../services/promonexai.server";
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
    if (!product_image_url || typeof product_image_url !== "string") {
      return Response.json({ success: false, video_url: null, error: "Missing or invalid product_image_url" }, { status: 400 });
    }
    if (!background_video_url || typeof background_video_url !== "string") {
      return Response.json({ success: false, video_url: null, error: "Missing or invalid background_video_url" }, { status: 400 });
    }
    if (!scene_id || typeof scene_id !== "string") {
      return Response.json({ success: false, video_url: null, error: "Missing or invalid scene_id" }, { status: 400 });
    }
    const result = await mergeVideo(product_image_url, background_video_url, scene_id, user_id);
    if (!result.success) {
      return Response.json({ success: false, video_url: null, error: result.error }, { status: 200 });
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoScene = (prisma as any).videoScene;
      await videoScene.update({
        where: { id: scene_id },
        data: { generatedVideoUrl: result.video_url },
      });
    } catch (err) {
      console.error("[app.api.video] mergeVideo: failed to update VideoScene:", err);
      // Still return success and video_url so the UI can show the video
    }
    return Response.json({ success: true, video_url: result.video_url, error: null });
  }

  return Response.json({ ok: false, error: `Unknown step: ${step}` }, { status: 400 });
};

export default function ApiVideoRoute() {
  return null;
}
