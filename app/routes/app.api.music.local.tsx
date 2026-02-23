import type { LoaderFunctionArgs } from "react-router";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../shopify.server";

/** GET — list background music from public/Music (genre folders with .mp3 files). No query params. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const musicDir = path.join(process.cwd(), "public", "Music");
  const tracks: Array<{ id: string; title: string; genre: string; preview_url: string; duration_seconds: number | null }> = [];

  try {
    const genreFolders = await readdir(musicDir, { withFileTypes: true });
    for (const dirent of genreFolders) {
      if (!dirent.isDirectory()) continue;
      const genre = dirent.name;
      const genrePath = path.join(musicDir, genre);
      const files = await readdir(genrePath, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile() || !f.name.toLowerCase().endsWith(".mp3")) continue;
        const baseName = f.name.slice(0, -4);
        const id = `${genre}/${baseName}`;
        const preview_url = `/Music/${encodeURIComponent(genre)}/${encodeURIComponent(f.name)}`;
        tracks.push({
          id,
          title: baseName.replace(/_/g, " "),
          genre,
          preview_url,
          duration_seconds: null,
        });
      }
    }
    tracks.sort((a, b) => a.genre.localeCompare(b.genre) || a.title.localeCompare(b.title));
    return Response.json({ success: true, tracks });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ success: false, tracks: [], error: message }, { status: 500 });
  }
};
