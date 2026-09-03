mod watcher;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            watcher::start_screenshot_watcher,
            watcher::stop_screenshot_watcher,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TarTrak");
}
