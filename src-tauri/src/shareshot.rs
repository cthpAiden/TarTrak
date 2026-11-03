//! Shared screenshots. Every new screenshot the game writes is read whole here, before the
//! watcher may delete it, and kept as the latest one. The share hotkey makes the app take a copy
//! with `take_shared_shot`, shrink it and send it to the squad.

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

const READ_ATTEMPTS: u32 = 30;
const READ_GAP: Duration = Duration::from_millis(100);
/// A 4K PNG is ~25 MB; anything far past that is not a game screenshot.
const MAX_PNG_BYTES: u64 = 64 * 1024 * 1024;
/// Every PNG ends with the IEND chunk: length 0, "IEND", then its fixed CRC.
const IEND: [u8; 12] = [0, 0, 0, 0, b'I', b'E', b'N', b'D', 0xAE, 0x42, 0x60, 0x82];

/// The latest screenshot, or None when the latest one could not be read.
#[derive(Default)]
pub struct SharedShot {
    png: Mutex<Option<Vec<u8>>>,
}

impl SharedShot {
    /// Reads the new screenshot at `path` and keeps it in place of the last one. Called by the
    /// watcher before the file is deleted. One that cannot be read clears the slot, so an older
    /// screenshot is never shared in its place.
    pub fn keep(&self, path: &Path) {
        let bytes = read_whole_png(path, READ_ATTEMPTS, READ_GAP);
        if let Ok(mut slot) = self.png.lock() {
            *slot = bytes;
        }
    }

    /// A copy of the latest screenshot; it stays kept, so a share refused for the rate limit can be retried.
    pub fn latest(&self) -> Option<Vec<u8>> {
        self.png.lock().ok()?.clone()
    }
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

/// The latest screenshot as raw PNG bytes.
#[tauri::command]
pub fn take_shared_shot(state: State<'_, SharedShot>) -> Result<tauri::ipc::Response, String> {
    state.latest().map(tauri::ipc::Response::new).ok_or_else(|| "no screenshot to share yet".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn keeps_the_latest_screenshot_until_the_next_one() {
        let dir = tempfile::tempdir().unwrap();
        let s = SharedShot::default();
        assert_eq!(s.latest(), None); // nothing yet
        let first = dir.path().join("first.png");
        let mut bytes = b"\x89PNG first".to_vec();
        bytes.extend_from_slice(&IEND);
        fs::write(&first, &bytes).unwrap();
        s.keep(&first);
        assert_eq!(s.latest(), Some(bytes.clone()));
        assert_eq!(s.latest(), Some(bytes)); // taking a copy keeps it
        let second = dir.path().join("second.png");
        let mut bytes = b"\x89PNG second".to_vec();
        bytes.extend_from_slice(&IEND);
        fs::write(&second, &bytes).unwrap();
        s.keep(&second);
        assert_eq!(s.latest(), Some(bytes));
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
