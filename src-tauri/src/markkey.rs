//! Mark-here chord poller. Reads the state of the mark key and the game's screenshot key with
//! `GetAsyncKeyState` every 10 ms and emits `markkey` when the screenshot key goes down while the
//! mark key is held. Either key alone does nothing. No keyboard hook is installed and no input is
//! ever sent: this is the same call push-to-talk apps make, and it never touches the game process.
//! The share key makes the same chord with the screenshot key, and arms a shared screenshot.

use crate::shareshot::{now_ms, SharedShot};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

const POLL: Duration = Duration::from_millis(10);

/// Bumped on every start or stop; a poller thread exits once the count moves past its own.
#[derive(Default)]
pub struct MarkKeyState(pub Arc<AtomicU64>, pub Mutex<()>);

#[cfg(windows)]
fn key_down(vk: u16) -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    // SAFETY: GetAsyncKeyState takes a plain integer and has no preconditions.
    (unsafe { GetAsyncKeyState(vk as i32) } as u16) & 0x8000 != 0
}

#[cfg(not(windows))]
fn key_down(_vk: u16) -> bool {
    false
}

/// Down-edge detector: true only on the poll where the key goes from up to down.
pub struct Edge {
    was_down: bool,
}

impl Edge {
    pub fn new() -> Self {
        Edge { was_down: false }
    }

    pub fn pressed(&mut self, down: bool) -> bool {
        let edge = down && !self.was_down;
        self.was_down = down;
        edge
    }
}

/// The chord: fires on the screenshot key's down-edge while the mark key is down.
pub struct Chord {
    shot: Edge,
}

impl Chord {
    pub fn new() -> Self {
        Chord { shot: Edge::new() }
    }

    pub fn tick(&mut self, mark_down: bool, shot_down: bool) -> bool {
        // The edge is tracked whether or not the mark key is held, so a screenshot taken without
        // it, then held down, cannot fire when the mark key is pressed later.
        let edge = self.shot.pressed(shot_down);
        edge && mark_down
    }
}

/// Whether a mark key `vk` and a share key `share_vk` (0 = off) can chord with `shot_vk`.
/// They may be the same key: that chord then both marks and shares.
pub fn usable_keys(vk: u32, shot_vk: u32, share_vk: u32) -> bool {
    let held_ok = |k: u32| k == 0 || (k <= 0xff && k != shot_vk);
    shot_vk != 0 && shot_vk <= 0xff && held_ok(vk) && held_ok(share_vk)
}

/// Start polling the mark key `vk`, the share key `share_vk` and the screenshot key `shot_vk`,
/// replacing any running poller. A key of 0 is off; both off only stops, there is no separate
/// stop command. Windows only: elsewhere the command stops and returns.
#[tauri::command]
pub fn start_mark_key(
    app: AppHandle,
    state: State<'_, MarkKeyState>,
    vk: u32,
    shot_vk: u32,
    share_vk: u32,
) -> Result<(), String> {
    let _serial = state.1.lock().map_err(|e| e.to_string())?;
    let generation = state.0.fetch_add(1, Ordering::SeqCst) + 1;
    if vk == 0 && share_vk == 0 {
        return Ok(());
    }
    if !usable_keys(vk, shot_vk, share_vk) {
        return Err(format!("not a usable key set: mark {vk}, share {share_vk}, screenshot {shot_vk}"));
    }
    if !cfg!(windows) {
        let _ = &app;
        return Ok(());
    }
    let (vk, shot_vk, share_vk) = (vk as u16, shot_vk as u16, share_vk as u16);
    let counter = Arc::clone(&state.0);
    std::thread::spawn(move || {
        let mut mark = Chord::new();
        let mut share = Chord::new();
        while counter.load(Ordering::SeqCst) == generation {
            let shot = key_down(shot_vk);
            if vk != 0 && mark.tick(key_down(vk), shot) {
                let _ = app.emit("markkey", ());
            }
            if share_vk != 0 && share.tick(key_down(share_vk), shot) {
                app.state::<SharedShot>().arm(now_ms());
            }
            std::thread::sleep(POLL);
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chord_fires_only_on_shot_edge_while_mark_held() {
        let mut c = Chord::new();
        assert!(!c.tick(true, false)); // mark alone
        assert!(c.tick(true, true)); // shot goes down while held
        assert!(!c.tick(true, true)); // still held: no repeat
        assert!(!c.tick(false, false));
        assert!(!c.tick(false, true)); // shot alone
        assert!(!c.tick(true, true)); // mark pressed after the shot: no fire
        assert!(!c.tick(true, false));
        assert!(c.tick(true, true)); // a fresh shot press while held
    }

    #[test]
    fn key_sets_need_a_screenshot_key_and_held_keys_that_are_not_it() {
        assert!(usable_keys(0xa4, 0x2c, 0));
        assert!(usable_keys(0, 0x2c, 0xa0));
        assert!(usable_keys(0xa4, 0x2c, 0xa0));
        assert!(!usable_keys(0xa4, 0, 0)); // no screenshot key
        assert!(usable_keys(0xa4, 0x2c, 0xa4)); // mark and share on one chord
        assert!(!usable_keys(0, 0x2c, 0x2c)); // share is the screenshot key
        assert!(!usable_keys(0x100, 0x2c, 0));
    }

    #[test]
    fn edge_fires_once_per_press() {
        let mut e = Edge::new();
        assert!(!e.pressed(false));
        assert!(e.pressed(true));
        assert!(!e.pressed(true));
        assert!(!e.pressed(false));
        assert!(e.pressed(true));
    }
}
