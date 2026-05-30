use crate::sftp;
use crate::ssh;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;
use tauri::command;
use tokio::time::sleep;

// [impl->feat~file-association-tool-mapping~1]
// [impl->req~temp-download-on-open~1]
// [impl->req~tool-mapping-config~1]

/// Tracks active file watchers so they can be cancelled.
static WATCHERS: LazyLock<Mutex<HashMap<String, tokio::task::AbortHandle>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn temp_dir_for(session_id: &str) -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("aether")
        .join("remote-files")
        .join(session_id)
}

/// Download a remote file to a local temp path, open it with the default
/// application, and start a background watcher that syncs changes back.
// [impl->feat~file-association-tool-mapping~1]
// [impl->req~temp-download-on-open~1]
#[command]
pub async fn open_remote_file(
    session_id: String,
    remote_path: String,
    _window: tauri::Window,
) -> Result<String, String> {
    // Verify session exists
    let _session =
        ssh::get_session(&session_id).ok_or_else(|| format!("Session {session_id} not found"))?;

    // Download file contents
    let data = sftp::read_file(session_id.clone(), remote_path.clone()).await?;

    // Build local temp path mirroring remote structure
    let temp_dir = temp_dir_for(&session_id);
    let local_path = temp_dir.join(remote_path.trim_start_matches('/'));
    std::fs::create_dir_all(local_path.parent().unwrap_or(&temp_dir)).map_err(|e| e.to_string())?;
    std::fs::write(&local_path, &data).map_err(|e| e.to_string())?;

    let local_path_str = local_path.to_string_lossy().to_string();

    // Open with default application
    open_with_default(&local_path_str).map_err(|e| e.to_string())?;

    // Start background watcher
    start_watcher(session_id, local_path_str.clone(), remote_path).await?;

    Ok(local_path_str)
}

/// Stop watching a file for changes.
// [impl->feat~file-association-tool-mapping~1]
#[command]
pub async fn unwatch_remote_file(local_path: String) -> Result<(), String> {
    if let Some(handle) = WATCHERS
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&local_path)
    {
        handle.abort();
    }
    Ok(())
}

/// Returns a list of local paths currently being watched.
#[command]
pub async fn list_watched_files() -> Result<Vec<String>, String> {
    let map = WATCHERS.lock().map_err(|e| e.to_string())?;
    Ok(map.keys().cloned().collect())
}

async fn start_watcher(
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    // If already watching this file, abort the old watcher
    if let Some(old) = WATCHERS
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&local_path)
    {
        old.abort();
    }

    let handle = tokio::spawn(watch_loop(session_id, local_path.clone(), remote_path));

    WATCHERS
        .lock()
        .map_err(|e| e.to_string())?
        .insert(local_path, handle.abort_handle());

    Ok(())
}

#[cfg(target_os = "macos")]
fn open_with_default(path: &str) -> std::io::Result<()> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()?
        .wait()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_with_default(path: &str) -> std::io::Result<()> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()?
        .wait()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_with_default(path: &str) -> std::io::Result<()> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", path])
        .spawn()?
        .wait()?;
    Ok(())
}

async fn watch_loop(session_id: String, local_path: String, remote_path: String) {
    let mut last_modified = match std::fs::metadata(&local_path).and_then(|m| m.modified()) {
        Ok(t) => t,
        Err(_) => return,
    };

    loop {
        sleep(Duration::from_secs(2)).await;

        let meta = match std::fs::metadata(&local_path) {
            Ok(m) => m,
            Err(_) => break, // file deleted locally
        };

        let modified = match meta.modified() {
            Ok(t) => t,
            Err(_) => continue,
        };

        if modified > last_modified {
            last_modified = modified;

            // Small debounce: wait another second to let the app finish writing
            sleep(Duration::from_secs(1)).await;

            let data = match std::fs::read(&local_path) {
                Ok(d) => d,
                Err(_) => continue,
            };

            // Upload back to remote
            let _ = sftp::write_file(session_id.clone(), remote_path.clone(), data).await;
        }
    }

    // Clean up watcher entry when loop exits
    let _ = WATCHERS.lock().map_err(|e| format!("{e}")).map(|mut m| {
        m.remove(&local_path);
    });
}
