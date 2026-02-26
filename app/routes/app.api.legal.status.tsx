import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getLegalStatus } from "../lib/legal.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const status = await getLegalStatus(session.shop);
  return Response.json(status);
};
