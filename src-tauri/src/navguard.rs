//! Keeps the main window on the app's own pages. A link, a redirect or a `<meta refresh>` that came in
//! with remote data would otherwise load a web page inside a window that runs elevated.

use tauri::Url;

/// `http://tauri.localhost` on Windows (https with `useHttpsScheme`), `tauri://localhost` elsewhere,
/// and the Vite dev server (tauri.conf.json `devUrl`) in a debug build.
pub fn is_app_url(url: &Url) -> bool {
    match (url.scheme(), url.host_str()) {
        ("http" | "https", Some("tauri.localhost")) | ("tauri", Some("localhost")) => true,
        ("http", Some("localhost")) => cfg!(debug_assertions) && url.port() == Some(1420),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(s: &str) -> bool {
        is_app_url(&Url::parse(s).unwrap())
    }

    #[test]
    fn allows_the_apps_own_pages() {
        assert!(ok("http://tauri.localhost/"));
        assert!(ok("http://tauri.localhost/index.html#settings"));
        assert!(ok("https://tauri.localhost/"));
        assert!(ok("tauri://localhost/"));
        // Tests build with debug assertions, like `npm run tauri dev`.
        assert!(ok("http://localhost:1420/"));
    }

    #[test]
    fn refuses_everything_else() {
        assert!(!ok("https://evil.example/"));
        assert!(!ok("http://tauri.localhost.evil.example/"));
        assert!(!ok("http://localhost:8080/"));
        assert!(!ok("file:///C:/Windows/System32/"));
        assert!(!ok("data:text/html,hi"));
        assert!(!ok("about:blank"));
        assert!(!ok("javascript:alert(1)"));
    }
}
