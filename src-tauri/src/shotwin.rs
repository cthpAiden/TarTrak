//! The shared-screenshot popup: its own small always-on-top window, so a player can put it anywhere
//! on the screen. It is created unfocused and unfocusable, so it never takes focus from the game: a
//! hidden window shown again would be activated, which is why it is closed rather than hidden.

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "shot";
/// Logical size: a 16:9 picture 320 wide under the 28 px header, plus the 1 px border top and bottom.
pub const WIDTH: f64 = 320.0;
pub const HEIGHT: f64 = 210.0;
/// The default spot's distance from the bottom-left corner of the work area.
const MARGIN: f64 = 24.0;

/// What the popup shows: JSON from the app, numbered so a close meant for an older one is ignored.
#[derive(Default)]
pub struct ShotPopup(Mutex<(u64, String)>);

#[derive(Clone, serde::Serialize)]
pub struct Shown {
    gen: u64,
    data: String,
}

/// A rectangle in logical pixels: x, y, width, height.
type Rect = (f64, f64, f64, f64);

/// Whether a popup at the logical point `(x, y)` would start inside one of the `screens`.
pub fn on_a_screen(screens: &[Rect], x: f64, y: f64) -> bool {
    screens.iter().any(|&(sx, sy, w, h)| x >= sx && y >= sy && x < sx + w && y < sy + h)
}

/// The default spot: the bottom-left corner of `work`, inset by the margin.
pub fn default_spot(work: Rect) -> (f64, f64) {
    let (x, y, _, h) = work;
    (x + MARGIN, y + h - HEIGHT - MARGIN)
}

/// A monitor's work area (the screen less the taskbar) in logical pixels.
fn logical_work_area(m: &tauri::Monitor) -> Rect {
    let s = m.scale_factor();
    let a = m.work_area();
    (a.position.x as f64 / s, a.position.y as f64 / s, a.size.width as f64 / s, a.size.height as f64 / s)
}

/// Shows `data` in the popup at the logical point `(x, y)`, or the default spot when none is given or it
/// is on no screen now. A popup already open keeps its place and shows the new data. Async: creating a
/// window from a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn open_shot_window(
    app: AppHandle,
    state: State<'_, ShotPopup>,
    data: String,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    let shown = {
        let mut cur = state.0.lock().map_err(|e| e.to_string())?;
        *cur = (cur.0 + 1, data);
        Shown { gen: cur.0, data: cur.1.clone() }
    };
    if let Some(w) = app.get_webview_window(LABEL) {
        return w.emit_to(LABEL, "shot-update", shown).map_err(|e| e.to_string());
    }
    let screens: Vec<Rect> = app.available_monitors().map_err(|e| e.to_string())?.iter().map(logical_work_area).collect();
    let (x, y) = match (x, y) {
        (Some(x), Some(y)) if on_a_screen(&screens, x, y) => (x, y),
        _ => {
            // The screen TarTrak is on, else the primary one.
            let main = app.get_webview_window("main").and_then(|w| w.current_monitor().ok().flatten());
            let mon = main.or(app.primary_monitor().map_err(|e| e.to_string())?);
            mon.map(|m| default_spot(logical_work_area(&m))).unwrap_or((MARGIN, MARGIN))
        }
    };
    WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("shot.html".into()))
        .title("TarTrak screenshot")
        .inner_size(WIDTH, HEIGHT)
        .position(x, y)
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
    Ok(())
}

/// What the popup should show now.
#[tauri::command]
pub fn shot_popup_data(state: State<'_, ShotPopup>) -> Result<Shown, String> {
    let cur = state.0.lock().map_err(|e| e.to_string())?;
    Ok(Shown { gen: cur.0, data: cur.1.clone() })
}

/// Closes the popup, unless it has been given something newer than `gen` meanwhile.
#[tauri::command]
pub fn close_shot_window(app: AppHandle, state: State<'_, ShotPopup>, gen: u64) -> Result<(), String> {
    let cur = state.0.lock().map_err(|e| e.to_string())?;
    if cur.0 == gen {
        if let Some(w) = app.get_webview_window(LABEL) {
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
        let screens = [(0.0, 0.0, 1920.0, 1040.0), (1920.0, 0.0, 2560.0, 1400.0)];
        assert!(on_a_screen(&screens, 100.0, 100.0));
        assert!(on_a_screen(&screens, 2000.0, 1300.0)); // second screen
        assert!(!on_a_screen(&screens, 5000.0, 100.0)); // a screen since unplugged
        assert!(!on_a_screen(&screens, -10.0, 100.0));
    }

    #[test]
    fn the_default_spot_is_the_bottom_left_of_the_work_area() {
        assert_eq!(default_spot((0.0, 0.0, 1920.0, 1040.0)), (24.0, 1040.0 - HEIGHT - 24.0));
        assert_eq!(default_spot((1920.0, 100.0, 2560.0, 1300.0)), (1944.0, 1400.0 - HEIGHT - 24.0));
    }
}
