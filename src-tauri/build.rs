fn main() {
    // See windows-app-manifest.xml: the app must run at the game's (elevated) level for the
    // mark-here key to be visible while the game is in front.
    let windows = tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows-app-manifest.xml"));
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri-build");
}
