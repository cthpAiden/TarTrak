//! Shared screenshots. The share chord (the share key held while the game's screenshot key goes
//! down, seen by the mark-key poller) arms this for a moment; the next screenshot the game writes
//! in that time is read whole here, before the watcher may delete it, and announced as
//! `sharedshot`. The app then takes the bytes with `take_shared_shot`, shrinks and sends them.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

/// The game writes the screenshot this long after the chord at most, as for mark-here.
pub const SHARE_WINDOW_MS: u64 = 2000;
const READ_ATTEMPTS: u32 = 30;
const READ_GAP: Duration = Duration::from_millis(100);
/// A 4K PNG is ~25 MB; anything far past that is not a game screenshot.
const MAX_PNG_BYTES: u64 = 64 * 1024 * 1024;
/// Every PNG ends with the IEND chunk: length 0, "IEND", then its fixed CRC.
const IEND: [u8; 12] = [0, 0, 0, 0, b'I', b'E', b'N', b'D', 0xAE, 0x42, 0x60, 0x82];

#[derive(Default)]
pub struct SharedShot {
    /// Epoch ms of the last share chord; 0 once a screenshot has used it.
    armed_at: AtomicU64,
    png: Mutex<Option<Vec<u8>>>,
}

impl SharedShot {
    pub fn arm(&self, now_ms: u64) {
        self.armed_at.store(now_ms, Ordering::SeqCst);
    }

    /// True once per chord, for a screenshot that lands within the window after it.
    pub fn take_arm(&self, now_ms: u64) -> bool {
        let at = self.armed_at.swap(0, Ordering::SeqCst);
        at != 0 && now_ms >= at && now_ms - at <= SHARE_WINDOW_MS
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// The file once the game has finished writing it: the create event comes before the last byte.
pub fn read_whole_png(path: &Path, attempts: u32, gap: Duration) -> Option<Vec<u8>> {
    for i in 0..attempts {
        if i > 0 {
            std::thread::sleep(gap);
        }
        let Ok(meta) = std::fs::metadata(path) else { continue };
        if meta.len() > MAX_PNG_BYTES {
            return None;
        }
        if let Ok(bytes) = std::fs::read(path) {
            if bytes.ends_with(&IEND) {
                return Some(bytes);
            }
        }
    }
    None
}

/// Called by the watcher for each new screenshot, before it is deleted. Announces even a file it
/// could not read, so the app can say the share failed instead of nothing happening.
pub fn grab_if_armed(app: &AppHandle, path: &Path, name: &str) {
    let shot = app.state::<SharedShot>();
    if !shot.take_arm(now_ms()) {
        return;
    }
    let bytes = read_whole_png(path, READ_ATTEMPTS, READ_GAP);
    if let Ok(mut slot) = shot.png.lock() {
        *slot = bytes;
    }
    let _ = app.emit("sharedshot", name);
}

/// The screenshot the last `sharedshot` announced, as raw PNG bytes; it can be taken once.
#[tauri::command]
pub fn take_shared_shot(state: State<'_, SharedShot>) -> Result<tauri::ipc::Response, String> {
    let png = state.png.lock().map_err(|e| e.to_string())?.take();
    png.map(tauri::ipc::Response::new).ok_or_else(|| "the screenshot could not be read".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn arm_is_used_once_and_only_within_the_window() {
        let s = SharedShot::default();
        assert!(!s.take_arm(1_000_000)); // never armed
        s.arm(1_000_000);
        assert!(s.take_arm(1_000_000 + SHARE_WINDOW_MS));
        assert!(!s.take_arm(1_000_000 + SHARE_WINDOW_MS)); // used up
        s.arm(1_000_000);
        assert!(!s.take_arm(1_000_000 + SHARE_WINDOW_MS + 1)); // too late
        assert!(!s.take_arm(1_000_000)); // and gone
    }

    #[test]
    fn reads_a_finished_png_and_gives_up_on_a_truncated_one() {
        let dir = tempfile::tempdir().unwrap();
        let whole = dir.path().join("whole.png");
        let mut bytes = b"\x89PNG\r\n\x1a\nbody".to_vec();
        bytes.extend_from_slice(&IEND);
        fs::write(&whole, &bytes).unwrap();
        assert_eq!(read_whole_png(&whole, 2, Duration::from_millis(1)), Some(bytes));

        let cut = dir.path().join("cut.png");
        fs::write(&cut, b"\x89PNG\r\n\x1a\nbody").unwrap();
        assert_eq!(read_whole_png(&cut, 2, Duration::from_millis(1)), None);
        assert_eq!(read_whole_png(&dir.path().join("missing.png"), 2, Duration::from_millis(1)), None);
    }

    #[test]
    fn waits_for_the_game_to_finish_writing() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("late.png");
        fs::write(&p, b"\x89PNG").unwrap();
        let q = p.clone();
        let writer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(60));
            let mut bytes = b"\x89PNG".to_vec();
            bytes.extend_from_slice(&IEND);
            fs::write(&q, bytes).unwrap();
        });
        assert!(read_whole_png(&p, 30, Duration::from_millis(20)).is_some());
        writer.join().unwrap();
    }
}
