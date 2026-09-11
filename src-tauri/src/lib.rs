mod detect;
mod logtail;
mod markkey;
mod watcher;

use tauri::{Emitter, Manager};
use tauri_plugin_window_state::StateFlags;

pub fn run() {
    tauri::Builder::default()
        // Must be registered before other plugins per tauri-plugin-single-instance's docs.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch is a request to see the window: bring the running one back.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("second-instance", ());
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Decorations follow overlay mode, which is not persisted: restoring them would
                // relaunch frameless without the rest of overlay mode. Visibility follows the hide
                // hotkey: quitting while hidden would otherwise relaunch to an invisible window
                // that looks like a failed start.
                .with_state_flags(StateFlags::all() - StateFlags::DECORATIONS - StateFlags::VISIBLE)
                .build(),
        )
        .manage(watcher::WatcherState::default())
        .manage(logtail::TailState::default())
        .manage(markkey::MarkKeyState::default())
        .invoke_handler(tauri::generate_handler![
            watcher::start_screenshot_watcher,
            watcher::stop_screenshot_watcher,
            logtail::start_log_tail_cmd,
            logtail::stop_log_tail_cmd,
            detect::detect_dirs,
            markkey::start_mark_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TarTrak");
}
