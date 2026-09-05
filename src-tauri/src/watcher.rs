use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const DELETE_ATTEMPTS: u32 = 5;
const DELETE_GAP: Duration = Duration::from_millis(200);

fn is_png(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("png"))
        .unwrap_or(false)
}

/// True for a screenshot the game named with coordinates: `date[time]_x, y, z_rx, ry, rz, rw...png`.
/// Menu screenshots (`date[time]_7.92 (0).png`) and anything else the player put there are kept.
pub fn is_position_shot(name: &str) -> bool {
    let Some(idx) = name.find("]_") else { return false };
    let rest = &name[idx + 2..];
    // Three coordinates and four quaternion parts: five commas, with an underscore between the groups.
    rest.matches(',').count() >= 5 && rest.contains('_')
}

/// Try to remove `path` up to `attempts` times, sleeping `gap` between tries.
/// The game may still hold the file handle right after writing it.
pub fn delete_with_retry(path: &Path, attempts: u32, gap: Duration) -> bool {
    for i in 0..attempts {
        if std::fs::remove_file(path).is_ok() {
            return true;
        }
        if !path.exists() {
            return false;
        }
        if i + 1 < attempts {
            std::thread::sleep(gap);
        }
    }
    false
}

/// Watch `dir` (non-recursive) for newly created PNG files. For each one call
/// `on_png` with the bare filename, then delete it on a helper thread when `delete` is set.
pub fn watch_screenshots(
    dir: &Path,
    delete: bool,
    on_png: impl Fn(String) + Send + 'static,
) -> notify::Result<RecommendedWatcher> {
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if !matches!(event.kind, EventKind::Create(_)) {
            return;
        }
        for path in event.paths {
            if !is_png(&path) {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            on_png(name.to_string());
            if delete && is_position_shot(name) {
                let p: PathBuf = path.clone();
                std::thread::spawn(move || {
                    delete_with_retry(&p, DELETE_ATTEMPTS, DELETE_GAP);
                });
            }
        }
    })?;
    watcher.watch(dir, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}

#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn start_screenshot_watcher(
    app: AppHandle,
    state: State<'_, WatcherState>,
    dir: String,
    delete: bool,
) -> Result<(), String> {
    let path = PathBuf::from(&dir);
    if !path.is_dir() {
        return Err(format!("not a directory: {dir}"));
    }
    state.0.lock().map_err(|e| e.to_string())?.take();
    let handle = app.clone();
    let watcher = watch_screenshots(&path, delete, move |name| {
        let _ = handle.emit("screenshot", name);
    })
    .map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_screenshot_watcher(state: State<'_, WatcherState>) {
    if let Ok(mut guard) = state.0.lock() {
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    fn wait_until(deadline: Duration, mut cond: impl FnMut() -> bool) -> bool {
        let start = Instant::now();
        while start.elapsed() < deadline {
            if cond() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        cond()
    }

    #[test]
    fn delete_with_retry_removes_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.png");
        fs::write(&p, b"x").unwrap();
        assert!(delete_with_retry(&p, 3, Duration::from_millis(10)));
        assert!(!p.exists());
    }

    #[test]
    fn delete_with_retry_reports_failure_for_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("missing.png");
        assert!(!delete_with_retry(&p, 2, Duration::from_millis(10)));
    }

    #[test]
    fn emits_filename_and_deletes_new_png() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel::<String>();
        let _w = watch_screenshots(dir.path(), true, move |name| {
            let _ = tx.send(name);
        })
        .unwrap();
        std::thread::sleep(Duration::from_millis(200)); // let the OS watch attach
        let p = dir.path().join("2026-09-04[04-56]_1, 2, 3_0, 0, 0, 1_0.5 (0).png");
        fs::write(&p, b"png").unwrap();
        let got = rx.recv_timeout(Duration::from_secs(5)).expect("event");
        assert_eq!(got, "2026-09-04[04-56]_1, 2, 3_0, 0, 0, 1_0.5 (0).png");
        assert!(wait_until(Duration::from_secs(3), || !p.exists()), "file should be deleted");
    }

    #[test]
    fn is_position_shot_matches_only_coordinate_names() {
        assert!(is_position_shot("2026-09-04[04-56]_-230.88, 3.59, -375.83_-0.02798, -0.17807, 0.00669, -0.98360_0.64 (0).png"));
        assert!(is_position_shot("2026-09-04[04-56]_1, 2, 3_0, 0, 0, 1_0.5.png"));
        assert!(!is_position_shot("2026-09-04[01-12]_7.92 (0).png"));
        assert!(!is_position_shot("holiday.png"));
    }

    #[test]
    fn keeps_a_menu_screenshot_even_with_delete_on() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel::<String>();
        let _w = watch_screenshots(dir.path(), true, move |name| {
            let _ = tx.send(name);
        })
        .unwrap();
        std::thread::sleep(Duration::from_millis(200));
        let p = dir.path().join("2026-09-04[01-12]_7.92 (0).png");
        fs::write(&p, b"png").unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).expect("event"), "2026-09-04[01-12]_7.92 (0).png");
        std::thread::sleep(Duration::from_millis(600));
        assert!(p.exists(), "menu screenshot must survive");
    }

    #[test]
    fn keeps_file_when_delete_disabled_and_ignores_non_png() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel::<String>();
        let _w = watch_screenshots(dir.path(), false, move |name| {
            let _ = tx.send(name);
        })
        .unwrap();
        std::thread::sleep(Duration::from_millis(200));
        fs::write(dir.path().join("notes.txt"), b"t").unwrap();
        let p = dir.path().join("shot.png");
        fs::write(&p, b"png").unwrap();
        let got = rx.recv_timeout(Duration::from_secs(5)).expect("event");
        assert_eq!(got, "shot.png");
        std::thread::sleep(Duration::from_millis(300));
        assert!(p.exists());
        assert!(rx.try_recv().is_err(), "txt must not produce an event");
    }
}
