/**
 * Temporary storage for "Create promo video" workflow state.
 * Only ephemeral UI is stored (tab, final view); asset data comes from Short/VideoScene/AudioInfo.
 * Deleted when user clicks Done (video completed).
 */

import prisma from "../db.server";

/** Slim state: activeTab, showingFinal, activePhase. Legacy payloads with extra keys are accepted but only these are persisted. */
export type WorkflowTempState = {
  activeTab: "scene1" | "scene2" | "scene3";
  showingFinal: boolean;
  activePhase: "scenes" | "audio" | "finalize";
};

export async function getWorkflowTemp(
  shop: string,
  productId: string
): Promise<WorkflowTempState | null> {
  const row = await prisma.promoWorkflowTemp.findUnique({
    where: { shop_productId: { shop, productId } },
  });
  if (!row || !row.state) return null;
  const raw = row.state as Record<string, unknown>;
  const phase = raw.activePhase === "audio" || raw.activePhase === "finalize" ? raw.activePhase : "scenes";
  return {
    activeTab: (raw.activeTab === "scene2" || raw.activeTab === "scene3" ? raw.activeTab : "scene1") as "scene1" | "scene2" | "scene3",
    showingFinal: Boolean(raw.showingFinal),
    activePhase: phase as "scenes" | "audio" | "finalize",
  };
}

export async function saveWorkflowTemp(
  shop: string,
  productId: string,
  state: Partial<WorkflowTempState> & { activeTab?: "scene1" | "scene2" | "scene3"; showingFinal?: boolean; activePhase?: "scenes" | "audio" | "finalize" }
): Promise<void> {
  const slim: WorkflowTempState = {
    activeTab: (state.activeTab === "scene2" || state.activeTab === "scene3" ? state.activeTab : "scene1"),
    showingFinal: Boolean(state.showingFinal),
    activePhase: (state.activePhase === "audio" || state.activePhase === "finalize" ? state.activePhase : "scenes"),
  };
  await prisma.promoWorkflowTemp.upsert({
    where: { shop_productId: { shop, productId } },
    create: { shop, productId, state: slim as object },
    update: { state: slim as object },
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
