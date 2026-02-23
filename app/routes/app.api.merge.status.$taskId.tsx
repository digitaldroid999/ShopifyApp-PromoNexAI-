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
    console.log(`${LOG} No result for taskId=${taskId}`);
    return Response.json({ error: "Status unavailable" }, { status: 502 });
  }
  return Response.json(result, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
};
