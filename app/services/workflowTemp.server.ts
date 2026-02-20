/**
 * Temporary storage for "Create promo video" workflow state.
 * Saved while generation is in progress; deleted when user clicks Done (video completed).
 */

import prisma from "../db.server";

export type WorkflowTempState = {
  activeTab: "scene1" | "scene2" | "scene3";
  scene1Complete: boolean;
  scene2Complete: boolean;
  scene3Complete: boolean;
  showingFinal: boolean;
  scriptGenerated: boolean;
  audioGenerated: boolean;
  scene1: {
    step: number;
    selectedImage: string | null;
    bgRemoved: string | null;
    bgImage: string | null;
    composited: string | null;
    sceneVideo: string | null;
  };
  scene2: {
    step: number;
    selectedImage: string | null;
    bgRemoved: string | null;
    selectedStockVideoUrl: string | null;
    sceneVideo: string | null;
  };
  scene3: {
    step: number;
    selectedImage: string | null;
    bgRemoved: string | null;
    bgImage: string | null;
    composited: string | null;
    sceneVideo: string | null;
  };
};

export async function getWorkflowTemp(
  shop: string,
  productId: string
): Promise<WorkflowTempState | null> {
  const row = await prisma.promoWorkflowTemp.findUnique({
    where: { shop_productId: { shop, productId } },
  });
  if (!row || !row.state) return null;
  return row.state as unknown as WorkflowTempState;
}

export async function saveWorkflowTemp(
  shop: string,
  productId: string,
  state: WorkflowTempState
): Promise<void> {
  await prisma.promoWorkflowTemp.upsert({
    where: { shop_productId: { shop, productId } },
    create: { shop, productId, state: state as object },
    update: { state: state as object },
  });
}

export async function deleteWorkflowTemp(
  shop: string,
  productId: string
): Promise<void> {
  await prisma.promoWorkflowTemp.deleteMany({
    where: { shop, productId },
  });
}
