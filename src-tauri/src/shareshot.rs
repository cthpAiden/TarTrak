//! Shared screenshots. Every new screenshot the game writes is read whole here, before the
//! watcher may delete it, and kept as the latest one. The share hotkey makes the app take a copy
//! with `take_shared_shot`, shrink it and send it to the squad.

use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
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
    /// Screenshots being read now: the game may still be writing one the player wants to share.
    reading: AtomicU32,
}

impl SharedShot {
    /// Reads the new screenshot at `path` and keeps it in place of the last one. Called by the
    /// watcher before the file is deleted. One that cannot be read clears the slot, so an older
    /// screenshot is never shared in its place.
    pub fn keep(&self, path: &Path) {
        self.reading.fetch_add(1, Ordering::SeqCst);
        let bytes = read_whole_png(path, READ_ATTEMPTS, READ_GAP);
        if let Ok(mut slot) = self.png.lock() {
            *slot = bytes;
        }
        self.reading.fetch_sub(1, Ordering::SeqCst);
    }

    /// A copy of the latest screenshot; it stays kept, so a share refused for the rate limit can be retried.
    pub fn latest(&self) -> Option<Vec<u8>> {
        self.png.lock().ok()?.clone()
    }

    /// The latest screenshot once any being read is in, so a share pressed right after the
    /// screenshot key sends that screenshot and not the one before. Waits `attempts` x `gap` at most.
    pub fn latest_when_read(&self, attempts: u32, gap: Duration) -> Option<Vec<u8>> {
        for _ in 0..attempts {
            if self.reading.load(Ordering::SeqCst) == 0 {
                break;
            }
            std::thread::sleep(gap);
        }
        self.latest()
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

/// The latest screenshot as raw PNG bytes. Async, so waiting for one being read does not hold up
/// the main thread.
#[tauri::command]
pub async fn take_shared_shot(state: State<'_, SharedShot>) -> Result<tauri::ipc::Response, String> {
    state
        .latest_when_read(READ_ATTEMPTS + 5, READ_GAP)
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "no screenshot taken since TarTrak started".to_string())
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
    fn a_share_waits_for_the_screenshot_still_being_written() {
        let dir = tempfile::tempdir().unwrap();
        let s = std::sync::Arc::new(SharedShot::default());
        let old = dir.path().join("old.png");
        let mut old_bytes = b"\x89PNG old".to_vec();
        old_bytes.extend_from_slice(&IEND);
        fs::write(&old, &old_bytes).unwrap();
        s.keep(&old);

        // The game has created the new file but not finished it.
        let new = dir.path().join("new.png");
        fs::write(&new, b"\x89PNG").unwrap();
        let (s2, new2) = (std::sync::Arc::clone(&s), new.clone());
        let reader = std::thread::spawn(move || s2.keep(&new2));
        while s.reading.load(Ordering::SeqCst) == 0 {
            std::thread::yield_now();
        }
        let mut new_bytes = b"\x89PNG new".to_vec();
        new_bytes.extend_from_slice(&IEND);
        let writer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            fs::write(&new, &new_bytes).unwrap();
            new_bytes
        });
        assert_eq!(s.latest_when_read(100, Duration::from_millis(20)), Some(writer.join().unwrap()));
        reader.join().unwrap();
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
