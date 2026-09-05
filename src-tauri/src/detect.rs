use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct DetectedDirs {
    pub screenshots: Option<String>,
    pub logs: Option<String>,
}

pub fn first_existing_dir(candidates: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|p| p.is_dir())
}

/// Ordered guesses for the EFT `Logs` folder: registry install location first,
/// then the common install layouts on every drive letter.
pub fn logs_candidates(install_from_registry: Option<PathBuf>) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(install) = install_from_registry {
        out.push(install.join("Logs"));
    }
    for letter in b'A'..=b'Z' {
        let d = letter as char;
        out.push(PathBuf::from(format!("{d}:\\Battlestate Games\\Escape from Tarkov\\Logs")));
        out.push(PathBuf::from(format!("{d}:\\Escape from Tarkov\\Logs")));
        out.push(PathBuf::from(format!("{d}:\\Games\\Escape from Tarkov\\Logs")));
    }
    out
}

#[cfg(windows)]
fn registry_install_location() -> Option<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    // The BSG launcher writes the uninstall entry per machine or, for a per-user install, per user.
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        let root = RegKey::predef(hive);
        for key in [
            "SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EscapeFromTarkov",
            "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EscapeFromTarkov",
        ] {
            if let Ok(k) = root.open_subkey(key) {
                if let Ok(loc) = k.get_value::<String, _>("InstallLocation") {
                    if !loc.is_empty() {
                        return Some(PathBuf::from(loc));
                    }
                }
            }
        }
    }
    None
}

#[cfg(not(windows))]
fn registry_install_location() -> Option<PathBuf> {
    None
}

fn screenshots_dir() -> Option<PathBuf> {
    let docs = dirs::document_dir()?;
    first_existing_dir([docs.join("Escape from Tarkov").join("Screenshots")])
}

#[tauri::command]
pub fn detect_dirs() -> DetectedDirs {
    let to_s = |p: PathBuf| p.to_string_lossy().to_string();
    DetectedDirs {
        screenshots: screenshots_dir().map(to_s),
        logs: first_existing_dir(logs_candidates(registry_install_location())).map(to_s),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_existing_dir_returns_first_that_exists() {
        let t = tempfile::tempdir().unwrap();
        let missing = t.path().join("nope");
        let present = t.path().join("yes");
        std::fs::create_dir(&present).unwrap();
        let got = first_existing_dir(vec![missing, present.clone(), t.path().to_path_buf()]);
        assert_eq!(got, Some(present));
    }

    #[test]
    fn first_existing_dir_none_when_nothing_exists() {
        let t = tempfile::tempdir().unwrap();
        assert_eq!(first_existing_dir(vec![t.path().join("a"), t.path().join("b")]), None);
    }

    #[test]
    fn logs_candidates_prefers_registry_then_probes_drives() {
        let c = logs_candidates(Some(PathBuf::from("Q:\\Games\\EFT")));
        assert_eq!(c[0], PathBuf::from("Q:\\Games\\EFT\\Logs"));
        assert!(c.contains(&PathBuf::from("C:\\Battlestate Games\\Escape from Tarkov\\Logs")));
        assert!(c.contains(&PathBuf::from("D:\\Escape from Tarkov\\Logs")));
        let no_reg = logs_candidates(None);
        assert!(no_reg.len() >= 26 * 3);
    }
}
