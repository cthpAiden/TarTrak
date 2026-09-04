# TarTrak v1 backlog (from implementation reviews)

Source: per-task review ledger and the final whole-branch review at commit 2f56dde. None of these block v1; ordered roughly by value.

## Parked after the final fix wave
- ghost marker if pos(new id) arrives before leave(old id) — ruling: real, minor, relay leave lag is rare; v1.1: on leave remove entry when a same-name teammate has newer receivedAt
- teammate marker gap after their reconnect until next screenshot — ruling: real, minor; v1.1: client re-queues last PosMsg on reopen
- hotkey field cannot be cleared to unbind — ruling: real, minor regression; v1.1: allow empty string as explicit unbind
- relay error toast repeats every 30 s on bad URL — ruling: real, minor; v1.1: toast once per connect()

## Deferred minors from per-task reviews
- (task 2) screenshot.ts parseScreenshotName lacks doc that arg is a basename not a path
- (task 2) tests resolve fixtures via process.cwd(); import.meta.url-relative would be sturdier
- (task 3) LOCATION_RE anchors on 'profileStatus:' only, not the full TRACE-NetworkGameCreate context
- (task 4) csp null in tauri.conf.json; tighten before release
- (task 4) unreferenced icons under src-tauri/icons (Square*Logo, StoreLogo, 64x64, icon.png)
- (task 5) no dedupe guard for repeated Create events (brief made it conditional)
- (task 5) delete_with_retry false result discarded silently; poisoned mutex makes stop a no-op
- (task 5) no test for watcher replacement or not-a-directory error path
- (task 6) newest_log_dir test does not discriminate mtime from lexical order; 30 ms timing gaps
- (task 6) truncation guard only at EOF; find_application_log non-deterministic with multiple matches; re-entry replays whole file
- (task 6) start_log_tail_cmd restart is non-atomic across two lock acquisitions; Err path replays whole file
- (task 8) unknown-map toast not deduped; startEventBridge untested
- (task 9) raw double cast on maps.json; makeCrs not memoized; loadMapDefs returns mutable cache; tsconfig include data/**/*.json likely unnecessary
- (task 10) heading line scales during zoom animation (zoomend only); http cache write non-atomic, no revalidation; linePoints() type-lies before first update; no MapView component test
- (task 10) sanitizer leaves javascript: hrefs, foreignObject, use, style untouched; no component-test harness for MapView effects
- (task 11) pickDir has no .catch (unhandled rejection); dirs assigned before awaited watcher start hides banner on failure; runtime GUI unverified (loopback blocked in agent shell)
- (task 12) string length measured in UTF-16 code units; TextEncoder allocated per call
- (task 13) /room/ empty code gives 404 not 400; 8-hex ids unchecked for collision; quiet() test helper consumes late messages; protocol copy drift unguarded until CI (Task 19 should add a cmp check)
- (task 14) throttle uses Date.now (NTP jump stalls); mergeSettings has no bounds (name > 32, lineLengthPx <= 0, lastRoom shape); hello toast unconditional; left toast only if teammate known; connect() not re-entrant; controller/RoomPanel untested
- (task 14) startEventBridge not isolated in onMount (rejection skips settings/dir phases)
- (task 15) stale-cache + failing-fetch combo untested; snapshot script exits 127 on Windows (libuv assert on process.exit with open sockets); QUEST_QUERY duplication unenforced; no shape validation on cached JSON
- (task 15, note) data/snapshot has no JSON (tarkov.dev 422 for hours); Task 19 must retry npm run snapshot
- (task 16) sort by marker count not on-map boolean; playerLevel min/max not clamped on persist; questPopupHtml untested; showExtracts not persisted
- (task 16) doneLoaded has no retry path after a failed load (saves blocked for the session, by design)
- (task 17) About links may be inert without opener plugin; toggle lacks aria-expanded; lineLen 0 falls back to 28; re-arm failure leaves deleteScreenshots persisted while watcher keeps old flag
- (task 18) concurrent armHotkeys calls can race; overlay/opacity not persisted across restart; runtime F5/F6/Alt+drag unverified
- (task 18) unmount during in-flight armHotkeys leaves new unhook uncalled
- (task 19) startup update check has no opt-out; signing key has empty password (document); updater has no unit test (fix round adds one)

## Release checklist
- Deploy the relay (`cd relay && npx wrangler deploy`) and set `DEFAULT_RELAY_URL` in `src/lib/settings/store.ts`.
- Create the GitHub repo; replace `tartrak-placeholder` in `src-tauri/tauri.conf.json` updater endpoint.
- Add repository secrets `TAURI_SIGNING_PRIVATE_KEY` (contents of %USERPROFILE%\.tauri\tartrak.key) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (empty). Back up the key file.
- Run `npm run snapshot` once tarkov.dev is reachable and commit `data/snapshot/*.json`.
- Manual GUI checklist (spec section 8): overlay over borderless EFT, F5/F6 with the game focused, Alt+drag, floors on Customs, two clients in one room.
