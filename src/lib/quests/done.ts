import { load } from "@tauri-apps/plugin-store";

export function toggleDone(done: Record<string, true>, taskId: string): Record<string, true> {
  if (done[taskId]) {
    const { [taskId]: _removed, ...rest } = done;
    return rest;
  }
  return { ...done, [taskId]: true };
}

const FILE = "quests-done.json";
const KEY = "done";

export async function loadDone(): Promise<Record<string, true>> {
  const store = await load(FILE, { defaults: {}, autoSave: false });
  const v = await store.get<unknown>(KEY);
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, true> = {};
  for (const k of Object.keys(v as Record<string, unknown>)) out[k] = true;
  return out;
}

export async function saveDone(d: Record<string, true>): Promise<void> {
  const store = await load(FILE, { defaults: {}, autoSave: false });
  await store.set(KEY, d);
  await store.save();
}
