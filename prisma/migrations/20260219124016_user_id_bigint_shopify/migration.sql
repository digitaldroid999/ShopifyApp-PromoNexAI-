/*
  Warnings:

  - You are about to alter the column `user_id` on the `audio_info` table. The data in that column could be lost. The data in that column will be cast from `String` to `BigInt`.
  - You are about to alter the column `user_id` on the `shorts` table. The data in that column could be lost. The data in that column will be cast from `String` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audio_info" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" BIGINT,
    "short_id" TEXT NOT NULL,
    "voice_id" TEXT,
    "voice_name" TEXT,
    "speed" REAL DEFAULT 1,
    "volume" REAL DEFAULT 1,
    "generated_audio_url" TEXT,
    "subtitles" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "audio_script" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "audio_info_short_id_fkey" FOREIGN KEY ("short_id") REFERENCES "shorts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_audio_info" ("audio_script", "created_at", "generated_audio_url", "id", "short_id", "speed", "status", "subtitles", "updated_at", "user_id", "voice_id", "voice_name", "volume") SELECT "audio_script", "created_at", "generated_audio_url", "id", "short_id", "speed", "status", "subtitles", "updated_at", "user_id", "voice_id", "voice_name", "volume" FROM "audio_info";
DROP TABLE "audio_info";
ALTER TABLE "new_audio_info" RENAME TO "audio_info";
CREATE UNIQUE INDEX "audio_info_short_id_key" ON "audio_info"("short_id");
CREATE TABLE "new_shorts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" BIGINT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "final_video_url" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_shorts" ("created_at", "final_video_url", "id", "metadata", "status", "title", "updated_at", "user_id") SELECT "created_at", "final_video_url", "id", "metadata", "status", "title", "updated_at", "user_id" FROM "shorts";
DROP TABLE "shorts";
ALTER TABLE "new_shorts" RENAME TO "shorts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
