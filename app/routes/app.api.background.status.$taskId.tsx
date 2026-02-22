import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getBackgroundGenerationStatus } from "../services/promonexai.server";

/** GET /app/api/background/status/:taskId — proxy to BACKEND_URL/background/status/{task_id} */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const taskId = params.taskId?.trim();
  if (!taskId) {
    return Response.json({ error: "taskId required" }, { status: 400 });
  }

  const result = await getBackgroundGenerationStatus(taskId);
  return Response.json(result);
};
