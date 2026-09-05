mod detect;
mod logtail;
mod watcher;

use tauri_plugin_window_state::StateFlags;

pub fn run() {
    tauri::Builder::default()
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
                // relaunch frameless without the rest of overlay mode.
                .with_state_flags(StateFlags::all() - StateFlags::DECORATIONS)
                .build(),
        )
        .manage(watcher::WatcherState::default())
        .manage(logtail::TailState::default())
        .invoke_handler(tauri::generate_handler![
            watcher::start_screenshot_watcher,
            watcher::stop_screenshot_watcher,
            logtail::start_log_tail_cmd,
            logtail::stop_log_tail_cmd,
            detect::detect_dirs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TarTrak");
}
