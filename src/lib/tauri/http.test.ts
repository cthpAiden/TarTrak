import { describe, it, expect, vi, beforeEach } from "vitest";

const files = new Map<string, { text: string; mtime: Date }>();
const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>>();

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (url: string) => fetchMock(url) }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  exists: async (p: string) => files.has(p) || p === "maps",
  mkdir: async () => {},
  readTextFile: async (p: string) => files.get(p)!.text,
  writeTextFile: async (p: string, text: string) => {
    files.set(p, { text, mtime: new Date(NOW) });
  },
  stat: async (p: string) => ({ mtime: files.get(p)!.mtime }),
}));

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

const { fetchTextCached, CACHE_MAX_AGE_MS } = await import("./http");

const ok = (text: string) => Promise.resolve({ ok: true, status: 200, text: async () => text });

describe("fetchTextCached", () => {
  beforeEach(() => {
    files.clear();
    fetchMock.mockReset();
  });

  it("fetches and stores on a miss", async () => {
    fetchMock.mockReturnValue(ok("<svg/>"));
    expect(await fetchTextCached("https://x/a.svg", "maps/a.svg", NOW)).toBe("<svg/>");
    expect(files.get("maps/a.svg")?.text).toBe("<svg/>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a fresh copy without touching the network", async () => {
    files.set("maps/a.svg", { text: "old", mtime: new Date(NOW - DAY) });
    expect(await fetchTextCached("https://x/a.svg", "maps/a.svg", NOW)).toBe("old");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a copy older than the max age", async () => {
    files.set("maps/a.svg", { text: "old", mtime: new Date(NOW - CACHE_MAX_AGE_MS - 1) });
    fetchMock.mockReturnValue(ok("new"));
    expect(await fetchTextCached("https://x/a.svg", "maps/a.svg", NOW)).toBe("new");
    expect(files.get("maps/a.svg")?.text).toBe("new");
  });

  it("keeps the stale copy when the refresh fails", async () => {
    files.set("maps/a.svg", { text: "old", mtime: new Date(NOW - 30 * DAY) });
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 503, text: async () => "" }));
    expect(await fetchTextCached("https://x/a.svg", "maps/a.svg", NOW)).toBe("old");
  });

  it("rejects when there is no copy and the fetch fails", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 404, text: async () => "" }));
    await expect(fetchTextCached("https://x/a.svg", "maps/a.svg", NOW)).rejects.toThrow(/404/);
  });
});
