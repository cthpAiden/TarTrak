use std::fs::{self, File};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, State};

const POLL: Duration = Duration::from_millis(500);
const DIR_CHECK_EVERY: u32 = 4; // polls between checks for a newer log dir (~2 s)

pub fn newest_log_dir(logs_root: &Path) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(logs_root).ok()?.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let is_log_dir = path.is_dir() && name.to_string_lossy().starts_with("log_");
        if !is_log_dir {
            continue;
        }
        let mtime = entry.metadata().and_then(|m| m.modified()).unwrap_or(SystemTime::UNIX_EPOCH);
        if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
            best = Some((mtime, path));
        }
    }
    best.map(|(_, p)| p)
}

pub fn find_application_log(log_dir: &Path) -> Option<PathBuf> {
    fs::read_dir(log_dir).ok()?.flatten().map(|e| e.path()).find(|p| {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        p.is_file() && name.contains("application") && name.ends_with(".log")
    })
}

pub struct LogTail {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl LogTail {
    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

impl Drop for LogTail {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

/// Follow the newest application log under `logs_root`, replaying it from the start,
/// then streaming appended lines. Switches files when a newer `log_*` dir appears.
pub fn start_log_tail(
    logs_root: PathBuf,
    on_line: impl Fn(String) + Send + Sync + 'static,
) -> LogTail {
    let stop = Arc::new(AtomicBool::new(false));
    let stop2 = stop.clone();
    let handle = std::thread::spawn(move || run(logs_root, stop2, on_line));
    LogTail { stop, handle: Some(handle) }
}

fn run(logs_root: PathBuf, stop: Arc<AtomicBool>, on_line: impl Fn(String)) {
    while !stop.load(Ordering::SeqCst) {
        let Some(dir) = newest_log_dir(&logs_root) else {
            std::thread::sleep(POLL);
            continue;
        };
        let Some(file) = find_application_log(&dir) else {
            std::thread::sleep(POLL);
            continue;
        };
        follow(&file, &dir, &logs_root, &stop, &on_line);
    }
}

/// Called whenever `follow` is idling at EOF-ish (nothing new to read yet, or a partial
/// line is still being written). Returns true if `follow` should stop polling and return:
/// either shutdown was requested, or a newer log dir has appeared. Shared by both the
/// EOF branch and the partial-line branch so they can't drift out of sync.
fn poll_boundary(stop: &AtomicBool, dir: &Path, logs_root: &Path, polls: &mut u32) -> bool {
    if stop.load(Ordering::SeqCst) {
        return true;
    }
    *polls += 1;
    if *polls % DIR_CHECK_EVERY == 0 {
        if let Some(newest) = newest_log_dir(logs_root) {
            if newest != dir {
                return true; // caller re-resolves and follows the new file
            }
        }
    }
    false
}

/// Read `file` from the start and keep polling for new lines until stopped or a newer dir appears.
fn follow(file: &Path, dir: &Path, logs_root: &Path, stop: &AtomicBool, on_line: &impl Fn(String)) {
    let Ok(f) = File::open(file) else {
        std::thread::sleep(POLL);
        return;
    };
    let mut reader = BufReader::new(f);
    let mut buf: Vec<u8> = Vec::new();
    let mut polls: u32 = 0;
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) => {
                if poll_boundary(stop, dir, logs_root, &mut polls) {
                    return;
                }
                // Truncation guard: if the file shrank, restart from its beginning.
                if let Ok(meta) = fs::metadata(file) {
                    if let Ok(pos) = reader.stream_position() {
                        if meta.len() < pos {
                            let _ = reader.seek(SeekFrom::Start(0));
                        }
                    }
                }
                std::thread::sleep(POLL);
            }
            Ok(_) => {
                if buf.last() != Some(&b'\n') {
                    // Partial line still being written: rewind and wait.
                    let _ = reader.seek(SeekFrom::Current(-(buf.len() as i64)));
                    if poll_boundary(stop, dir, logs_root, &mut polls) {
                        return;
                    }
                    std::thread::sleep(POLL);
                    continue;
                }
                let line = String::from_utf8_lossy(&buf);
                on_line(line.trim_end_matches(['\r', '\n']).to_string());
            }
            Err(_) => {
                // Dead/unreadable handle: give up on this file and let `run` re-resolve
                // the newest dir and file rather than looping on it forever.
                std::thread::sleep(POLL);
                return;
            }
        }
    }
}

#[derive(Default)]
pub struct TailState(pub Mutex<Option<LogTail>>);

#[tauri::command]
pub fn start_log_tail_cmd(
    app: AppHandle,
    state: State<'_, TailState>,
    logs_root: String,
) -> Result<(), String> {
    let root = PathBuf::from(&logs_root);
    if !root.is_dir() {
        return Err(format!("not a directory: {logs_root}"));
    }
    // Stop any existing tail (dropping the lock before the join) so it can't keep
    // emitting `logline` concurrently with the new tail we're about to start.
    let old = state.0.lock().map_err(|e| e.to_string())?.take();
    if let Some(old) = old {
        old.stop();
    }
    let handle = app.clone();
    let tail = start_log_tail(root, move |line| {
        let _ = handle.emit("logline", line);
    });
    *state.0.lock().map_err(|e| e.to_string())? = Some(tail);
    Ok(())
}

#[tauri::command]
pub fn stop_log_tail_cmd(state: State<'_, TailState>) {
    let old = state.0.lock().ok().and_then(|mut guard| guard.take());
    if let Some(old) = old {
        old.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, OpenOptions};
    use std::io::Write;
    use std::sync::mpsc;
    use std::time::Duration;

    fn mk_log(root: &Path, dir: &str, name: &str, content: &str) -> PathBuf {
        let d = root.join(dir);
        fs::create_dir_all(&d).unwrap();
        let f = d.join(name);
        fs::write(&f, content).unwrap();
        f
    }

    #[test]
    fn newest_log_dir_picks_latest_mtime_log_prefixed_dir() {
        let root = tempfile::tempdir().unwrap();
        mk_log(root.path(), "log_2026.09.03_13-52-26_1", "a application_000.log", "");
        std::thread::sleep(Duration::from_millis(30));
        mk_log(root.path(), "log_2026.09.04_4-19-42_1", "b application_000.log", "");
        fs::create_dir_all(root.path().join("other")).unwrap();
        let newest = newest_log_dir(root.path()).unwrap();
        assert!(newest.ends_with("log_2026.09.04_4-19-42_1"));
    }

    #[test]
    fn find_application_log_matches_only_application_log() {
        let root = tempfile::tempdir().unwrap();
        let d = root.path().join("log_x");
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("x backend_000.log"), "").unwrap();
        let app = d.join("x application_000.log");
        fs::write(&app, "").unwrap();
        assert_eq!(find_application_log(&d).unwrap(), app);
        assert!(find_application_log(root.path()).is_none());
    }

    #[test]
    fn replays_existing_lines_then_streams_new_ones_and_switches_dirs() {
        let root = tempfile::tempdir().unwrap();
        let f1 = mk_log(root.path(), "log_1", "1 application_000.log", "first\r\nsecond\n");
        let (tx, rx) = mpsc::channel::<String>();
        let tail = start_log_tail(root.path().to_path_buf(), move |l| {
            let _ = tx.send(l);
        });

        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), "first");
        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), "second");

        let mut fh = OpenOptions::new().append(true).open(&f1).unwrap();
        writeln!(fh, "third").unwrap();
        drop(fh);
        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), "third");

        std::thread::sleep(Duration::from_millis(30));
        mk_log(root.path(), "log_2", "2 application_000.log", "fresh\n");
        assert_eq!(rx.recv_timeout(Duration::from_secs(10)).unwrap(), "fresh");

        tail.stop();
    }

    #[test]
    fn stop_returns_promptly_when_log_ends_mid_line() {
        let root = tempfile::tempdir().unwrap();
        mk_log(root.path(), "log_1", "1 application_000.log", "first\r\npartial");
        let (tx, rx) = mpsc::channel::<String>();
        let tail = start_log_tail(root.path().to_path_buf(), move |l| {
            let _ = tx.send(l);
        });

        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), "first");

        let start = std::time::Instant::now();
        tail.stop();
        let elapsed = start.elapsed();
        assert!(
            elapsed < Duration::from_secs(3),
            "stop() should return promptly even with a dangling partial line, took {elapsed:?}"
        );
    }
}
