/**
 * Video scene status: stored in video_scenes.status.
 * Scene 1 & 3: step1 → bg_removed → step2 → bg_image_fetched_generated → images_compositied → step3 → video_generated
 * Scene 2: step1 → bg_removed → step2 → bg_video_fetched → video_generated
 */

export const SCENE13_STATUSES = [
  "step1",
  "bg_removed",
  "step2",
  "bg_image_fetched_generated",
  "images_compositied",
  "step3",
  "video_generated",
] as const;

export const SCENE2_STATUSES = [
  "step1",
  "bg_removed",
  "step2",
  "bg_video_fetched",
  "video_generated",
] as const;

export type Scene13Status = (typeof SCENE13_STATUSES)[number];
export type Scene2Status = (typeof SCENE2_STATUSES)[number];

/** Treat legacy "pending" as step1 */
export const NORMALIZE_PENDING = "step1";

/**
 * Scene 1 & 3: Previous is not step-by-step.
 * - From video_generated or step3 → images_compositied (step 2)
 * - From images_compositied / step2 / bg_image_fetched_generated → bg_removed (step 1)
 * - From bg_removed / step1 → already at first step (null)
 */
export function getScene13PreviousStatus(current: string): Scene13Status | null {
  const s = current?.trim() || "step1";
  if (s === "video_generated" || s === "step3") return "images_compositied";
  if (s === "images_compositied" || s === "step2" || s === "bg_image_fetched_generated") return "bg_removed";
  return null;
}

/**
 * Scene 2: Previous is not step-by-step.
 * - From video_generated (step 2) → bg_removed (step 1)
 * - From bg_video_fetched / step2 → bg_removed
 * - From bg_removed / step1 → already at first step (null)
 */
export function getScene2PreviousStatus(current: string): Scene2Status | null {
  const s = current?.trim() || "step1";
  if (s === "video_generated" || s === "step2" || s === "bg_video_fetched") return "bg_removed";
  return null;
}

export function getScene13NextStatus(current: string): Scene13Status | null {
  const idx = SCENE13_STATUSES.indexOf(current as Scene13Status);
  if (idx < 0 || idx >= SCENE13_STATUSES.length - 1) return null;
  return SCENE13_STATUSES[idx + 1];
}

export function getScene2NextStatus(current: string): Scene2Status | null {
  const idx = SCENE2_STATUSES.indexOf(current as Scene2Status);
  if (idx < 0 || idx >= SCENE2_STATUSES.length - 1) return null;
  return SCENE2_STATUSES[idx + 1];
}

/** Normalize status for scene 1/3 (pending → step1) */
export function normalizeScene13Status(s: string | null | undefined): Scene13Status {
  if (!s || s === "pending") return NORMALIZE_PENDING as Scene13Status;
  return SCENE13_STATUSES.includes(s as Scene13Status) ? (s as Scene13Status) : (NORMALIZE_PENDING as Scene13Status);
}

/** Normalize status for scene 2 */
export function normalizeScene2Status(s: string | null | undefined): Scene2Status {
  if (!s || s === "pending") return NORMALIZE_PENDING as Scene2Status;
  return SCENE2_STATUSES.includes(s as Scene2Status) ? (s as Scene2Status) : (NORMALIZE_PENDING as Scene2Status);
}

export function isScene13Finished(status: string): boolean {
  return status === "video_generated";
}

export function isScene2Finished(status: string): boolean {
  return status === "video_generated";
}

/** When going previous from this status, clear these fields (scene 1/3) */
export function getScene13ClearFieldsWhenGoingPrevious(current: string): { imageUrl?: boolean; generatedVideoUrl?: boolean; fetchedMedia?: boolean } {
  switch (current) {
    case "video_generated":
    case "step3":
      return { generatedVideoUrl: true };
    case "images_compositied":
      return { imageUrl: true };
    case "bg_image_fetched_generated":
    case "step2":
      return { imageUrl: true, fetchedMedia: true };
    case "bg_removed":
      return { imageUrl: true };
    default:
      return {};
  }
}

/** When going previous from this status, clear these fields (scene 2) */
export function getScene2ClearFieldsWhenGoingPrevious(current: string): { imageUrl?: boolean; generatedVideoUrl?: boolean; fetchedMedia?: boolean } {
  switch (current) {
    case "video_generated":
      return { generatedVideoUrl: true };
    case "bg_video_fetched":
      return { imageUrl: true, fetchedMedia: true };
    case "bg_removed":
      return { imageUrl: true };
    default:
      return {};
  }
}
