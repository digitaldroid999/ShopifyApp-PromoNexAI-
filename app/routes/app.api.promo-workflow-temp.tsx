import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getWorkflowTemp,
  saveWorkflowTemp,
  deleteWorkflowTemp,
  type WorkflowTempState,
} from "../services/workflowTemp.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId?.trim()) {
    return Response.json({ error: "productId required" }, { status: 400 });
  }
  const state = await getWorkflowTemp(session.shop, productId.trim());
  if (!state) {
    return Response.json({ state: null });
  }
  return Response.json({ state });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") || undefined;

  if (request.method === "DELETE") {
    if (!productId?.trim()) {
      return Response.json({ error: "productId required" }, { status: 400 });
    }
    await deleteWorkflowTemp(session.shop, productId.trim());
    return Response.json({ ok: true });
  }

  if (request.method === "POST") {
    let body: { productId?: string; state?: WorkflowTempState };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const id = body.productId?.trim() || productId?.trim();
    if (!id) {
      return Response.json({ error: "productId required" }, { status: 400 });
    }
    if (!body.state || typeof body.state !== "object") {
      return Response.json({ error: "state required" }, { status: 400 });
    }
    await saveWorkflowTemp(session.shop, id, body.state as WorkflowTempState);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

export default function ApiPromoWorkflowTempRoute() {
  return null;
}
