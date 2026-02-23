import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { finalizeShortStatus } from "../services/promonexai.server";

const LOG = "[API merge/status]";

/** GET /app/api/merge/status/:taskId — proxy to BACKEND_URL/merge/status/{task_id} */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const taskId = params.taskId?.trim();
  if (!taskId) {
    return Response.json({ error: "taskId required" }, { status: 400 });
  }
  const result = await finalizeShortStatus(taskId);
  if (!result) {
    console.log(`${LOG} No result taskId=${taskId} (backend error or invalid JSON)`);
    return Response.json({ error: "Status unavailable" }, { status: 502 });
  }
  if (result.status === "completed" || result.status === "failed") {
    console.log(`${LOG} taskId=${taskId} status=${result.status} progress=${result.progress ?? "-"} final_video_url=${result.final_video_url ? "set" : "-"} error_message=${result.error_message ?? "-"}`);
  }
  return Response.json(result, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
};
