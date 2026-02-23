import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getBackgroundGenerationStatus } from "../services/promonexai.server";

const LOG = "[API background/status]";

/** GET /app/api/background/status/:taskId — proxy to BACKEND_URL/background/status/{task_id} */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const taskId = params.taskId?.trim();
  if (!taskId) {
    console.log(`${LOG} [1] Missing taskId`);
    return Response.json({ error: "taskId required" }, { status: 400 });
  }
  console.log(`${LOG} [1] Poll status taskId=${taskId}`);
  const result = await getBackgroundGenerationStatus(taskId);
  console.log(`${LOG} [2] Result status=${result.status}`, result.image_url ? "image_url present" : "", result.error ? `error=${result.error}` : "");
  return Response.json(result);
};
