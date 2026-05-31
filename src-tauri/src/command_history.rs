use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

// [impl->feat~cross-session-command-history~1]
// [impl->req~command-history-configurable-hotkeys~1]

const MAX_HISTORY: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandHistoryEntry {
    pub command: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandHistoryFile {
    entries: Vec<CommandHistoryEntry>,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aether")
}

fn history_path() -> PathBuf {
    config_dir().join("command_history.toml")
}

fn read_history_file() -> Result<CommandHistoryFile, String> {
    let path = history_path();
    if !path.exists() {
        return Ok(CommandHistoryFile { entries: vec![] });
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    toml::from_str(&contents).map_err(|e| e.to_string())
}

fn write_history_file(file: &CommandHistoryFile) -> Result<(), String> {
    let path = history_path();
    std::fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let contents = toml::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

// [impl->feat~cross-session-command-history~1]
#[command]
pub async fn list_command_history() -> Result<Vec<CommandHistoryEntry>, String> {
    let file = read_history_file()?;
    Ok(file.entries)
}

#[command]
pub async fn add_command_history(command: String) -> Result<(), String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let mut file = read_history_file()?;

    // Deduplicate: if the last entry is identical, replace its timestamp.
    if let Some(last) = file.entries.last() {
        if last.command == trimmed {
            file.entries.pop();
        }
    }

    file.entries.push(CommandHistoryEntry {
        command: trimmed.to_string(),
        timestamp: Utc::now().to_rfc3339(),
    });

    // Trim to max size from the front.
    if file.entries.len() > MAX_HISTORY {
        let excess = file.entries.len() - MAX_HISTORY;
        file.entries.drain(0..excess);
    }

    write_history_file(&file)
}

#[command]
pub async fn clear_command_history() -> Result<(), String> {
    write_history_file(&CommandHistoryFile { entries: vec![] })
}
