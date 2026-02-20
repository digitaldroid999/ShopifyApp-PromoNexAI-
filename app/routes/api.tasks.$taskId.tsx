import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { fetchRemotionTaskStatus } from "../services/remotion.server";
import { mergeVideoTaskStatus } from "../services/promonexai.server";

const LOG_PREFIX = "[Tasks API]";

const isScene2MergeTask = (task: { metadata?: unknown; stage?: string | null }) => {
  const meta = task.metadata as { type?: string } | null | undefined;
  return meta?.type === "scene2_merge" || task.stage === "scene2_merge";
};

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

  const isTerminal = task.status === "completed" || task.status === "failed";
  if (!isTerminal) {
    // Scene 2 merge: poll backend merge-video/tasks/{task_id}
    if (isScene2MergeTask(task)) {
      const mergeStatus = await mergeVideoTaskStatus(task.remotionTaskId);
      if (mergeStatus) {
        console.log(`${LOG_PREFIX} Scene2 merge task ${task.remotionTaskId} → status=${mergeStatus.status}`);

        const updates: { status: string; videoUrl?: string | null; error?: string | null } = {
          status: mergeStatus.status,
        };
        if (mergeStatus.status === "completed" && mergeStatus.video_url) {
          updates.videoUrl = mergeStatus.video_url;
        }
        if (mergeStatus.status === "failed" && mergeStatus.error_message) {
          updates.error = mergeStatus.error_message;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = await (prisma as any).task.update({
          where: { id: taskId },
          data: updates,
        });

        // Persist scene2 result to video_scenes.generated_video_url (VideoScene.generatedVideoUrl)
        if (mergeStatus.status === "completed" && mergeStatus.video_url && task.videoSceneId) {
          try {
            await (prisma as any).videoScene.update({
              where: { id: task.videoSceneId },
              data: { generatedVideoUrl: mergeStatus.video_url, status: "ready" },
            });
            console.log(`${LOG_PREFIX} Scene2 merge completed. Saved generated_video_url to VideoScene ${task.videoSceneId}`);
          } catch (e) {
            console.error(`${LOG_PREFIX} Failed to update VideoScene (scene2):`, e);
          }
        }

        return Response.json(
          { id: updated.id, status: updated.status, stage: updated.stage, progress: updated.progress, videoUrl: updated.videoUrl, error: updated.error },
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
        );
      }
    }

    // Remotion (e.g. scene 1): poll Remotion API
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

      if (remotion.status === "completed" && remotion.videoUrl) {
        try {
          const videoSceneId =
            task.videoSceneId ??
            (await (prisma as any).videoScene
              .findFirst({ where: { shortId: task.shortId, sceneNumber: 1 }, select: { id: true } })
              .then((s: { id: string } | null) => s?.id ?? null));
          if (videoSceneId) {
            await (prisma as any).videoScene.update({
              where: { id: videoSceneId },
              data: { generatedVideoUrl: remotion.videoUrl, status: "ready" },
            });
            console.log(`${LOG_PREFIX} Completed. Saved generated_video_url to VideoScene ${videoSceneId} (scene 1)`);
          } else {
            console.warn(`${LOG_PREFIX} Completed but no VideoScene found for shortId=${task.shortId} scene 1; generated URL not saved to VideoScene.`);
          }
        } catch (e) {
          console.error(`${LOG_PREFIX} Failed to update VideoScene generated_video_url:`, e);
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
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
          },
        }
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
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
};
