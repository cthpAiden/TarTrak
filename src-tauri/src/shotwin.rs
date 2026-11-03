//! The shared-screenshot popup: its own small always-on-top window, so a player can put it anywhere
//! on the screen. It is created unfocused and unfocusable, so it never takes focus from the game: a
//! hidden window shown again would be activated, which is why it is closed rather than hidden.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "shot";
/// Logical size: a 16:9 picture 320 wide under the 28 px header, plus the 1 px border top and bottom.
pub const WIDTH: f64 = 320.0;
pub const HEIGHT: f64 = 210.0;
/// The default spot's distance from the bottom-left corner of the work area.
const MARGIN: f64 = 24.0;

/// What the popup shows: JSON from the app, numbered so a close meant for an older one is ignored.
#[derive(Default)]
pub struct ShotPopup {
    shown: Mutex<(u64, String)>,
    /// Held by one open at a time, so two screenshots at once cannot both try to create the window.
    /// Only async commands take it: the main thread, which creates windows, never waits on it.
    opening: Mutex<()>,
    /// Set once the popup is being destroyed: it still exists for a moment but can show nothing more.
    closing: AtomicBool,
}

#[derive(Clone, serde::Serialize)]
pub struct Shown {
    gen: u64,
    data: String,
}

/// A rectangle in physical pixels: x, y, width, height. Physical, because logical pixels are not
/// one space across screens at different scales.
type Rect = (i32, i32, i32, i32);

/// The popup's size in physical pixels on a screen at `scale`.
fn size_at(scale: f64) -> (i32, i32) {
    ((WIDTH * scale).round() as i32, (HEIGHT * scale).round() as i32)
}

/// The saved spot `at`, moved just enough for the whole popup to fit in `work` (a screen's work
/// area, at `scale`); None when `at` is not on that screen, say one since unplugged.
pub fn fit_in(work: Rect, scale: f64, at: (i32, i32)) -> Option<(i32, i32)> {
    let (x, y, w, h) = work;
    let (ax, ay) = at;
    if ax < x || ay < y || ax >= x + w || ay >= y + h {
        return None;
    }
    let (pw, ph) = size_at(scale);
    Some((ax.min(x + w - pw).max(x), ay.min(y + h - ph).max(y)))
}

/// The default spot: the bottom-left corner of `work`, inset by the margin.
pub fn default_spot(work: Rect, scale: f64) -> (i32, i32) {
    let (x, y, _, h) = work;
    let margin = (MARGIN * scale).round() as i32;
    (x + margin, y + h - size_at(scale).1 - margin)
}

/// A monitor's work area (the screen less the taskbar) in physical pixels.
fn work_area(m: &Monitor) -> Rect {
    let a = m.work_area();
    (a.position.x, a.position.y, a.size.width as i32, a.size.height as i32)
}

/// Shows `data` in the popup at the physical point `(x, y)`, or the default spot when none is given
/// or it is on no screen now. A popup already open keeps its place and shows the new data. Async:
/// creating a window from a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn open_shot_window(
    app: AppHandle,
    state: State<'_, ShotPopup>,
    data: String,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    let _one = state.opening.lock().map_err(|e| e.to_string())?;
    {
        let mut cur = state.shown.lock().map_err(|e| e.to_string())?;
        *cur = (cur.0 + 1, data);
    }
    // A popup that is closing is gone in a moment; wait for it rather than send it what it cannot show.
    for _ in 0..50 {
        match app.get_webview_window(LABEL) {
            // It reads what to show itself: the screenshot is too big to send twice.
            Some(w) if !state.closing.load(Ordering::SeqCst) => {
                return w.emit_to(LABEL, "shot-update", ()).map_err(|e| e.to_string());
            }
            Some(_) => std::thread::sleep(Duration::from_millis(20)),
            None => break,
        }
    }
    state.closing.store(false, Ordering::SeqCst);
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let saved = x.zip(y).map(|(x, y)| (x.round() as i32, y.round() as i32));
    let fitted = saved.and_then(|at| {
        monitors.iter().find_map(|m| fit_in(work_area(m), m.scale_factor(), at).map(|p| (p, m.scale_factor())))
    });
    let ((px, py), scale) = match fitted {
        Some(spot) => spot,
        None => {
            // The screen TarTrak is on, else the primary one.
            let main = app.get_webview_window("main").and_then(|w| w.current_monitor().ok().flatten());
            match main.or(app.primary_monitor().map_err(|e| e.to_string())?) {
                Some(m) => (default_spot(work_area(&m), m.scale_factor()), m.scale_factor()),
                None => ((MARGIN as i32, MARGIN as i32), 1.0),
            }
        }
    };
    let w = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("shot.html".into()))
        .title("TarTrak screenshot")
        .inner_size(WIDTH, HEIGHT)
        .position(px as f64 / scale, py as f64 / scale)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .focusable(false)
        .build()
        .map_err(|e| e.to_string())?;
    // The builder takes logical pixels, and the window is placed with the scale of the first screen
    // they land on: with screens at different scales that can be another screen. Moving it does not
    // activate it.
    let at = PhysicalPosition::new(px, py);
    if w.outer_position().map_err(|e| e.to_string())? != at {
        w.set_position(at).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// What the popup should show now.
#[tauri::command]
pub fn shot_popup_data(state: State<'_, ShotPopup>) -> Result<Shown, String> {
    let cur = state.shown.lock().map_err(|e| e.to_string())?;
    Ok(Shown { gen: cur.0, data: cur.1.clone() })
}

/// Closes the popup, unless it has been given something newer than `gen` meanwhile.
#[tauri::command]
pub fn close_shot_window(app: AppHandle, state: State<'_, ShotPopup>, gen: u64) -> Result<(), String> {
    let cur = state.shown.lock().map_err(|e| e.to_string())?;
    if cur.0 == gen {
        if let Some(w) = app.get_webview_window(LABEL) {
            // Under the lock: an open that numbered something newer has either already reached the
            // window (so gen differs and this does nothing) or will see this flag and wait.
            state.closing.store(true, Ordering::SeqCst);
            w.destroy().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_saved_spot_counts_only_while_a_screen_holds_it() {
        let screen = (0, 0, 1920, 1040);
        assert_eq!(fit_in(screen, 1.0, (100, 100)), Some((100, 100)));
        assert_eq!(fit_in(screen, 1.0, (5000, 100)), None); // a screen since unplugged
        assert_eq!(fit_in(screen, 1.0, (-10, 100)), None);
        // A screen to the left of the primary one has negative coordinates.
        assert_eq!(fit_in((-2560, 0, 2560, 1400), 1.5, (-2000, 300)), Some((-2000, 300)));
    }

    #[test]
    fn a_saved_spot_near_the_edge_is_moved_until_the_whole_popup_fits() {
        // At 150% the popup is 480 x 315 pixels.
        assert_eq!(fit_in((0, 0, 1920, 1040), 1.5, (1900, 1000)), Some((1920 - 480, 1040 - 315)));
        // A screen smaller than the popup keeps its top-left corner on the screen.
        assert_eq!(fit_in((0, 0, 300, 200), 1.0, (10, 10)), Some((0, 0)));
    }

    #[test]
    fn the_default_spot_is_the_bottom_left_of_the_work_area() {
        assert_eq!(default_spot((0, 0, 1920, 1040), 1.0), (24, 1040 - 210 - 24));
        // A second screen at 150%: margin and height scale with it.
        assert_eq!(default_spot((1920, 100, 3840, 2100), 1.5), (1920 + 36, 2200 - 315 - 36));
    }
}
