import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { fetchRemotionTaskStatus } from "../services/remotion.server";

const LOG_PREFIX = "[Tasks API]";

/**
 * GET /api/tasks/:taskId - Task status (used for polling).
 * This route is outside the /app layout so authenticate.admin() runs only once per request,
 * avoiding duplicate "Authenticating admin request" logs.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const taskId = params.taskId?.trim();
  if (!taskId) {
    return Response.json({ error: "taskId required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const task = await (prisma as any).task.findUnique({ where: { id: taskId } });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  console.log(`${LOG_PREFIX} Poll taskId=${taskId} status=${task.status} stage=${task.stage ?? "-"} progress=${task.progress ?? "-"}%`);

  // If still pending, poll Remotion and update our Task (and VideoScene if completed)
  if (task.status === "pending") {
    const remotion = await fetchRemotionTaskStatus(task.remotionTaskId);
    if (remotion) {
      console.log(`${LOG_PREFIX} Remotion task ${task.remotionTaskId} → status=${remotion.status} stage=${remotion.stage ?? "-"} progress=${remotion.progress ?? "-"}%`);

      const updates: { status: string; stage?: string; progress?: number | null; videoUrl?: string | null; error?: string | null } = {
        status: remotion.status,
        stage: remotion.stage ?? undefined,
        progress: remotion.progress ?? null,
      };
      if (remotion.status === "completed" && remotion.videoUrl) {
        updates.videoUrl = remotion.videoUrl;
      }
      if (remotion.status === "failed" && remotion.error) {
        updates.error = remotion.error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (prisma as any).task.update({
        where: { id: taskId },
        data: updates,
      });

      // When completed, set VideoScene.generatedVideoUrl
      if (remotion.status === "completed" && remotion.videoUrl && task.videoSceneId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma as any).videoScene.update({
            where: { id: task.videoSceneId },
            data: {
              generatedVideoUrl: remotion.videoUrl,
              status: "ready",
            },
          });
          console.log(`${LOG_PREFIX} Completed. Updated VideoScene ${task.videoSceneId} videoUrl=${remotion.videoUrl}`);
        } catch (e) {
          console.error(`${LOG_PREFIX} Failed to update VideoScene:`, e);
        }
      }

      if (updated.status === "failed") {
        console.log(`${LOG_PREFIX} Task failed: ${updated.error ?? "unknown"}`);
      }

      return Response.json(
        {
          id: updated.id,
          status: updated.status,
          stage: updated.stage,
          progress: updated.progress,
          videoUrl: updated.videoUrl,
          error: updated.error,
        },
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return Response.json(
    {
      id: task.id,
      status: task.status,
      stage: task.stage,
      progress: task.progress,
      videoUrl: task.videoUrl,
      error: task.error,
    },
    { headers: { "Content-Type": "application/json" } }
  );
};
