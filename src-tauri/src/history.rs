use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

// [impl->feat~session-history~1]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub color: String,
    pub connected_at: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
}

// TOML requires a named key for arrays of tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryFile {
    entries: Vec<HistoryEntry>,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aether")
}

fn history_path() -> PathBuf {
    config_dir().join("history.toml")
}

fn read_history_file() -> Result<HistoryFile, String> {
    let path = history_path();
    if !path.exists() {
        return Ok(HistoryFile { entries: vec![] });
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    // Try new wrapper format first, then fall back to raw array for compatibility.
    if let Ok(file) = toml::from_str::<HistoryFile>(&contents) {
        return Ok(file);
    }
    if let Ok(entries) = toml::from_str::<Vec<HistoryEntry>>(&contents) {
        return Ok(HistoryFile { entries });
    }
    Err("Failed to parse history.toml".to_string())
}

fn write_history_file(file: &HistoryFile) -> Result<(), String> {
    let path = history_path();
    std::fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let contents = toml::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

// [impl->feat~session-history~1]
#[command]
pub async fn list_history() -> Result<Vec<HistoryEntry>, String> {
    let file = read_history_file()?;
    Ok(file.entries)
}

// [impl->feat~session-history~1]
pub async fn add_history_entry(profile: &crate::profiles::Profile) -> Result<(), String> {
    let mut file = read_history_file()?;

    // Remove any existing entry with the same profile_id to avoid duplicates
    file.entries.retain(|e| e.profile_id != profile.id);

    // Add new entry at the front
    let entry = HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        profile_id: profile.id.clone(),
        name: profile.name.clone(),
        host: profile.host.clone(),
        port: profile.port,
        username: profile.username.clone(),
        auth_type: profile.auth_type.clone(),
        color: profile.color.clone(),
        connected_at: Utc::now().to_rfc3339(),
        password: profile.password.clone(),
        private_key_path: profile.private_key_path.clone(),
    };
    file.entries.insert(0, entry);

    // Keep only the last 50 entries
    if file.entries.len() > 50 {
        file.entries.truncate(50);
    }

    write_history_file(&file)?;
    Ok(())
}

// [impl->feat~session-history~1]
#[command]
pub async fn clear_history() -> Result<(), String> {
    let path = history_path();
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
