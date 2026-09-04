import { fetch } from "@tauri-apps/plugin-http";
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const APP = { baseDir: BaseDirectory.AppData };

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function ensureParent(relPath: string): Promise<void> {
  const dir = relPath.split("/").slice(0, -1).join("/");
  if (dir && !(await exists(dir, APP))) await mkdir(dir, { ...APP, recursive: true });
}

/** Read `relPath` from the app data dir; on miss, fetch `url`, store it, return it. */
export async function fetchTextCached(url: string, relPath: string): Promise<string> {
  if (await exists(relPath, APP)) return readTextFile(relPath, APP);
  const text = await fetchText(url);
  await ensureParent(relPath);
  await writeTextFile(relPath, text, APP);
  return text;
}
