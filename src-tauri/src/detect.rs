use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct DetectedDirs {
    pub screenshots: Option<String>,
    pub logs: Option<String>,
}

pub fn first_existing_dir(candidates: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|p| p.is_dir())
}

/// Ordered guesses for the EFT `Logs` folder: registry install location first, then any
/// Tarkov folder in a Steam library, then the common install layouts on every drive letter.
pub fn logs_candidates(install_from_registry: Option<PathBuf>, steam_games: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(install) = install_from_registry {
        out.push(install.join("Logs"));
    }
    out.extend(steam_games.into_iter().map(|g| g.join("Logs")));
    for letter in b'A'..=b'Z' {
        let d = letter as char;
        out.push(PathBuf::from(format!("{d}:\\Battlestate Games\\Escape from Tarkov\\Logs")));
        out.push(PathBuf::from(format!("{d}:\\Battlestate Games\\EscapeFromTarkov\\Logs")));
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

/// Every `"path"` value in Steam's `libraryfolders.vdf`, with the VDF's doubled backslashes undone.
pub fn library_paths(vdf: &str) -> Vec<PathBuf> {
    vdf.lines()
        .filter_map(|line| {
            let rest = line.trim().strip_prefix("\"path\"")?.trim();
            let value = rest.strip_prefix('"')?.strip_suffix('"')?;
            Some(PathBuf::from(value.replace("\\\\", "\\")))
        })
        .collect()
}

/// Folders under `steamapps\common` whose name mentions Tarkov; the exact Steam folder name is not pinned down.
pub fn tarkov_dirs_in_library(library: &std::path::Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(library.join("steamapps").join("common")) else {
        return Vec::new();
    };
    let mut out: Vec<PathBuf> = entries
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().to_lowercase().contains("tarkov"))
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    out.sort();
    out
}

#[cfg(windows)]
fn steam_games() -> Vec<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let Ok(steam) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Software\\Valve\\Steam")
        .and_then(|k| k.get_value::<String, _>("SteamPath"))
    else {
        return Vec::new();
    };
    let steam = PathBuf::from(steam);
    let mut libraries = vec![steam.clone()];
    if let Ok(vdf) = std::fs::read_to_string(steam.join("steamapps").join("libraryfolders.vdf")) {
        libraries.extend(library_paths(&vdf));
    }
    libraries.dedup();
    libraries.iter().flat_map(|l| tarkov_dirs_in_library(l)).collect()
}

#[cfg(not(windows))]
fn steam_games() -> Vec<PathBuf> {
    Vec::new()
}

fn screenshots_dir() -> Option<PathBuf> {
    let docs = dirs::document_dir()?;
    first_existing_dir([docs.join("Escape from Tarkov").join("Screenshots")])
}

/// `async`: off the main thread. Probing a mapped network drive that is offline can block for many
/// seconds, and the app calls this every 10 s until the Screenshots folder exists.
#[tauri::command(async)]
pub fn detect_dirs() -> DetectedDirs {
    let to_s = |p: PathBuf| p.to_string_lossy().to_string();
    DetectedDirs {
        screenshots: screenshots_dir().map(to_s),
        logs: first_existing_dir(logs_candidates(registry_install_location(), steam_games())).map(to_s),
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
    fn logs_candidates_prefers_registry_then_steam_then_probes_drives() {
        let steam = vec![PathBuf::from("S:\\SteamLibrary\\steamapps\\common\\Escape from Tarkov")];
        let c = logs_candidates(Some(PathBuf::from("Q:\\Games\\EFT")), steam);
        assert_eq!(c[0], PathBuf::from("Q:\\Games\\EFT\\Logs"));
        assert_eq!(c[1], PathBuf::from("S:\\SteamLibrary\\steamapps\\common\\Escape from Tarkov\\Logs"));
        assert!(c.contains(&PathBuf::from("C:\\Battlestate Games\\Escape from Tarkov\\Logs")));
        assert!(c.contains(&PathBuf::from("C:\\Battlestate Games\\EscapeFromTarkov\\Logs")));
        assert!(c.contains(&PathBuf::from("D:\\Escape from Tarkov\\Logs")));
        let no_reg = logs_candidates(None, Vec::new());
        assert!(no_reg.len() >= 26 * 4);
    }

    #[test]
    fn library_paths_reads_every_path_from_libraryfolders_vdf() {
        let vdf = r#""libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
		"label"		""
	}
	"1"
	{
		"path"		"E:\\SteamLibrary"
	}
}"#;
        assert_eq!(
            library_paths(vdf),
            vec![PathBuf::from("C:\\Program Files (x86)\\Steam"), PathBuf::from("E:\\SteamLibrary")]
        );
    }

    #[test]
    fn tarkov_dirs_in_library_picks_folders_named_tarkov() {
        let lib = tempfile::tempdir().unwrap();
        let common = lib.path().join("steamapps").join("common");
        std::fs::create_dir_all(common.join("Escape from Tarkov")).unwrap();
        std::fs::create_dir_all(common.join("Counter-Strike Global Offensive")).unwrap();
        assert_eq!(tarkov_dirs_in_library(lib.path()), vec![common.join("Escape from Tarkov")]);
        assert!(tarkov_dirs_in_library(&lib.path().join("missing")).is_empty());
    }
}
