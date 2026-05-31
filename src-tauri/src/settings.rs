use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::LazyLock;
use std::sync::Mutex;
use tauri::command;

// [impl->feat~file-association-tool-mapping~1]
// [impl->req~tool-mapping-config~1]
// [impl->feat~cross-session-command-history~1]
// [impl->req~command-history-configurable-hotkeys~1]

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAssociation {
    pub extension: String,
    pub tool_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    #[serde(default = "default_previous_command_hotkey")]
    pub previous_command: String,
    #[serde(default = "default_next_command_hotkey")]
    pub next_command: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        HotkeyConfig {
            previous_command: default_previous_command_hotkey(),
            next_command: default_next_command_hotkey(),
        }
    }
}

fn default_previous_command_hotkey() -> String {
    "Shift+ArrowUp".to_string()
}

fn default_next_command_hotkey() -> String {
    "Shift+ArrowDown".to_string()
}

// TOML requires a named key for arrays of tables.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsFile {
    #[serde(default)]
    associations: Vec<FileAssociation>,
    #[serde(default)]
    hotkeys: HotkeyConfig,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aether")
}

fn settings_path() -> PathBuf {
    config_dir().join("settings.toml")
}

fn read_settings_file() -> Result<SettingsFile, String> {
    let path = settings_path();
    if !path.exists() {
        return Ok(SettingsFile::default());
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    toml::from_str(&contents).map_err(|e| e.to_string())
}

fn write_settings_file(file: &SettingsFile) -> Result<(), String> {
    let path = settings_path();
    std::fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let contents = toml::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

/// In-memory cache so remote_edit.rs can look up associations without disk IO.
static ASSOCIATIONS_CACHE: LazyLock<Mutex<Vec<FileAssociation>>> =
    LazyLock::new(|| Mutex::new(vec![]));

fn refresh_cache() -> Result<(), String> {
    let file = read_settings_file()?;
    let mut cache = ASSOCIATIONS_CACHE.lock().map_err(|e| e.to_string())?;
    *cache = file.associations;
    Ok(())
}

/// Returns the tool path configured for a given file extension, if any.
pub fn get_tool_for_extension(ext: &str) -> Option<String> {
    let cache = ASSOCIATIONS_CACHE.lock().ok()?;
    cache
        .iter()
        .find(|a| a.extension.eq_ignore_ascii_case(ext))
        .map(|a| a.tool_path.clone())
}

// [impl->feat~file-association-tool-mapping~1]
// [impl->req~tool-mapping-config~1]
#[command]
pub async fn list_file_associations() -> Result<Vec<FileAssociation>, String> {
    refresh_cache()?;
    let cache = ASSOCIATIONS_CACHE.lock().map_err(|e| e.to_string())?;
    Ok(cache.clone())
}

#[command]
pub async fn save_file_association(association: FileAssociation) -> Result<(), String> {
    let mut file = read_settings_file()?;
    if let Some(idx) = file
        .associations
        .iter()
        .position(|a| a.extension.eq_ignore_ascii_case(&association.extension))
    {
        file.associations[idx] = association;
    } else {
        file.associations.push(association);
    }
    write_settings_file(&file)?;
    refresh_cache()?;
    Ok(())
}

#[command]
pub async fn delete_file_association(extension: String) -> Result<(), String> {
    let mut file = read_settings_file()?;
    file.associations
        .retain(|a| !a.extension.eq_ignore_ascii_case(&extension));
    write_settings_file(&file)?;
    refresh_cache()?;
    Ok(())
}

// [impl->feat~cross-session-command-history~1]
// [impl->req~command-history-configurable-hotkeys~1]
#[command]
pub async fn get_hotkey_config() -> Result<HotkeyConfig, String> {
    let file = read_settings_file()?;
    Ok(file.hotkeys)
}

#[command]
pub async fn save_hotkey_config(config: HotkeyConfig) -> Result<(), String> {
    let mut file = read_settings_file()?;
    file.hotkeys = config;
    write_settings_file(&file)?;
    Ok(())
}
