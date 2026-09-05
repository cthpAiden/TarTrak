import { fetch } from "@tauri-apps/plugin-http";
import { BaseDirectory, exists, mkdir, readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";

const APP = { baseDir: BaseDirectory.AppData };

/** Map drawings change with every wipe, so a cached copy is refreshed once it is this old. */
export const CACHE_MAX_AGE_MS = 7 * 86_400_000;

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function ensureParent(relPath: string): Promise<void> {
  const dir = relPath.split("/").slice(0, -1).join("/");
  if (dir && !(await exists(dir, APP))) await mkdir(dir, { ...APP, recursive: true });
}

/** Age of the cached file in ms; Infinity when its modification time is unknown. */
async function cacheAge(relPath: string, now: number): Promise<number> {
  try {
    const info = await stat(relPath, APP);
    return info.mtime ? now - info.mtime.getTime() : Infinity;
  } catch {
    return Infinity;
  }
}

/**
 * Read `relPath` from the app data dir; on miss, fetch `url`, store it, return it. A copy older than
 * CACHE_MAX_AGE_MS is refreshed first, and stays in use when the refresh fails (offline).
 */
export async function fetchTextCached(url: string, relPath: string, now = Date.now()): Promise<string> {
  const cached = await exists(relPath, APP);
  if (cached && (await cacheAge(relPath, now)) <= CACHE_MAX_AGE_MS) return readTextFile(relPath, APP);
  let text: string;
  try {
    text = await fetchText(url);
  } catch (e) {
    if (cached) return readTextFile(relPath, APP);
    throw e;
  }
  await ensureParent(relPath);
  await writeTextFile(relPath, text, APP);
  return text;
}
