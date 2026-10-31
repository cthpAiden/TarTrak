<script lang="ts">
  import type { RaidRecord } from "./record";
  import type { ReplayTrail } from "../map/replayLayer";
  import { mmss, raidSpan, shotStats, stepShot, TAIL_MS } from "./replay";

  let {
    raid,
    trails,
    at,
    onSeek,
  }: {
    raid: RaidRecord;
    /** Mine first, then each teammate, in the colours the map draws them. */
    trails: ReplayTrail[];
    /** The playhead, epoch ms. */
    at: number;
    onSeek: (at: number) => void;
  } = $props();

  const SPEEDS = [1, 4, 16, 64] as const;
  const TICK_MS = 100;

  let playing = $state(false);
  let speed = $state<(typeof SPEEDS)[number]>(16);

  const span = $derived(raidSpan(raid));
  const length = $derived(Math.max(1, span.end - span.start));
  const stats = $derived(shotStats(raid));
  const pct = (t: number) => `${(((t - span.start) / length) * 100).toFixed(3)}%`;
  const clock = $derived(new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

  // Another raid picked: stop rather than play it on from where the last one was.
  $effect(() => {
    void raid.startedAt;
    playing = false;
  });

  $effect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = at + TICK_MS * speed;
      if (next >= span.end) {
        onSeek(span.end);
        playing = false;
      } else onSeek(next);
    }, TICK_MS);
    return () => clearInterval(id);
  });

  function togglePlay() {
    // From the end, play starts over from the spawn.
    if (!playing && at >= span.end) onSeek(span.start);
    playing = !playing;
  }

  function step(dir: -1 | 1) {
    const t = stepShot(raid, at, dir);
    if (t !== null) onSeek(t);
  }
</script>

<section class="replay-stats" aria-label="My screenshots in this raid">
  <div><span>My screenshots</span><b class="accent">{stats.count}</b></div>
  <div><span>One every</span><b>{stats.everyS} s</b></div>
  <div><span>Longest gap</span><b>{mmss(stats.longestMs)}</b></div>
</section>

<section class="replay-dock" aria-label="Raid replay">
  <div class="controls">
    <button type="button" class="step" onclick={() => step(-1)} aria-label="My previous screenshot" title="My previous screenshot">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor"><path d="M3 3h2v10H3zM13 3v10L6 8z" /></svg>
    </button>
    <button type="button" class="play" onclick={togglePlay} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"}>
      {#if playing}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
      {:else}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M5 3v10l8-5z" /></svg>
      {/if}
    </button>
    <button type="button" class="step" onclick={() => step(1)} aria-label="My next screenshot" title="My next screenshot">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor"><path d="M11 3h2v10h-2zM3 3v10l7-5z" /></svg>
    </button>
    <span class="time mono"><b>{mmss(at - span.start)}</b> / {mmss(length)} · {clock}</span>
    <span class="grow"></span>
    <span class="muted">Speed</span>
    <div class="speeds" role="group" aria-label="Speed">
      {#each SPEEDS as s (s)}
        <button type="button" aria-pressed={speed === s} onclick={() => (speed = s)}>{s}×</button>
      {/each}
    </div>
  </div>

  <div class="lanes">
    {#each trails as t (t.key)}
      <div class="lane">
        <span class="name" style:color={t.color} title={t.name}>{t.name}</span>
        <div class="track">
          {#if t.mine}
            {#each stats.gaps as g (g.from)}
              <div class="gap" style:left={pct(g.from)} style:width={`${((g.to - g.from) / length) * 100}%`}></div>
            {/each}
          {/if}
          {#each t.points as p, i (i)}
            <div class="tick" style:left={pct(p.t)} style:background={t.color}></div>
          {/each}
        </div>
      </div>
    {/each}
    <div class="head-area">
      <div class="head" style:left={pct(at)}></div>
      <input
        type="range"
        min={span.start}
        max={span.end}
        step="1000"
        value={at}
        oninput={(e) => {
          playing = false;
          onSeek(Number(e.currentTarget.value));
        }}
        aria-label="Replay time"
        aria-valuetext={mmss(at - span.start)}
      />
    </div>
  </div>
  <div class="legend muted">
    <span>spawn</span>
    <span>Bright: last {TAIL_MS / 60_000} min · shaded: my gaps over 1 min</span>
    <span>{mmss(length)}</span>
  </div>
</section>

<style>
  .replay-stats {
    position: absolute; left: 12px; top: 12px; z-index: 1000; display: flex; gap: 16px; padding: 8px 12px;
    background: rgba(15, 18, 22, 0.9); border: 1px solid var(--line); border-radius: 8px;
  }
  .replay-stats div { display: flex; flex-direction: column; gap: 2px; }
  .replay-stats span { font-size: 11px; color: var(--muted); }
  .replay-stats b { font: 600 17px var(--mono); }
  .replay-stats .accent { color: var(--accent); }

  .replay-dock {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 1000; box-sizing: border-box; padding: 10px 14px 8px;
    display: flex; flex-direction: column; gap: 8px; background: rgba(22, 26, 32, 0.96); border-top: 1px solid var(--line);
  }
  .controls { display: flex; align-items: center; gap: 8px; }
  .controls button {
    display: grid; place-items: center; padding: 0; cursor: pointer; border: 1px solid var(--line-2); border-radius: 6px;
    background: var(--raised); color: var(--fg-2);
  }
  .step { width: 30px; height: 30px; }
  .controls .play { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--accent); color: var(--on-accent); }
  .time { margin-left: 6px; color: var(--muted); font-size: 12px; }
  .time b { color: var(--fg); font-size: 14px; }
  .speeds { display: flex; padding: 2px; gap: 2px; background: #0f1216; border-radius: 6px; }
  .speeds button { height: 24px; padding: 0 8px; border: 0; background: none; color: var(--muted); font: 500 12px var(--mono); }
  .speeds button[aria-pressed="true"] { background: var(--line-2); color: var(--fg); }

  .lanes { position: relative; display: flex; flex-direction: column; gap: 5px; }
  .lane { display: flex; align-items: center; gap: 10px; }
  .name { width: 70px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 12px; }
  .track { position: relative; flex: 1; height: 18px; background: #0f1216; border-radius: 4px; overflow: hidden; }
  .gap { position: absolute; top: 0; bottom: 0; background: rgba(240, 180, 41, 0.16); }
  .tick { position: absolute; top: 4px; bottom: 4px; width: 2px; margin-left: -1px; }
  /* Over the tracks only (the names column is 70 px plus the 10 px gap): the playhead and the seek slider. */
  .head-area { position: absolute; left: 80px; right: 0; top: -4px; bottom: -4px; }
  .head { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--fg); pointer-events: none; }
  .head-area input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .head-area input:focus-visible { opacity: 0.25; }
  .legend { display: flex; justify-content: space-between; padding-left: 80px; font-size: 11px; }
</style>
