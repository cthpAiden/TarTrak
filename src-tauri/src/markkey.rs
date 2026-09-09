//! Mark-here key poller. Reads the state of one key with `GetAsyncKeyState` every 10 ms and emits
//! `markkey` on each down-edge. No keyboard hook is installed and no input is ever sent: this is
//! the same call push-to-talk apps make, and it never touches the game process.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

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

/// Start polling `vk`, replacing any running poller. `vk == 0` only stops; there is no separate
/// stop command. Windows only: elsewhere the command stops and returns.
#[tauri::command]
pub fn start_mark_key(app: AppHandle, state: State<'_, MarkKeyState>, vk: u32) -> Result<(), String> {
    let _serial = state.1.lock().map_err(|e| e.to_string())?;
    let generation = state.0.fetch_add(1, Ordering::SeqCst) + 1;
    if vk == 0 || vk > 0xff {
        return if vk == 0 { Ok(()) } else { Err(format!("not a virtual-key code: {vk}")) };
    }
    if !cfg!(windows) {
        let _ = &app;
        return Ok(());
    }
    let vk = vk as u16;
    let counter = Arc::clone(&state.0);
    std::thread::spawn(move || {
        let mut edge = Edge::new();
        while counter.load(Ordering::SeqCst) == generation {
            if edge.pressed(key_down(vk)) {
                let _ = app.emit("markkey", ());
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
    fn edge_fires_once_per_press() {
        let mut e = Edge::new();
        assert!(!e.pressed(false));
        assert!(e.pressed(true));
        assert!(!e.pressed(true));
        assert!(!e.pressed(false));
        assert!(e.pressed(true));
    }
}
