-- CreateTable
CREATE TABLE "shorts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "final_video_url" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "video_scenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "short_id" TEXT NOT NULL,
    "scene_number" INTEGER NOT NULL,
    "duration" REAL NOT NULL,
    "image_url" TEXT,
    "generated_video_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "generate_video_prompt" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "video_scenes_short_id_fkey" FOREIGN KEY ("short_id") REFERENCES "shorts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audio_info" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "audio_info_short_id_key" ON "audio_info"("short_id");
