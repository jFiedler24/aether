use crate::ssh;
use serde::{Deserialize, Serialize};
use tauri::command;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn copy_remote_file_to_local(
    session_id: &str,
    remote_path: &str,
    local_path: &std::path::Path,
) -> Result<(), String> {
    let sftp = ssh::get_sftp_session(session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;
    let sftp = sftp.lock().await;

    let mut remote_file = sftp
        .open(remote_path)
        .await
        .map_err(|e| format!("SFTP open failed: {e}"))?;

    if let Some(parent) = local_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut local_file = tokio::fs::File::create(local_path)
        .await
        .map_err(|e| e.to_string())?;

    tokio::io::copy(&mut remote_file, &mut local_file)
        .await
        .map_err(|e| format!("SFTP stream copy failed: {e}"))?;

    local_file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

// [impl->req~sftp-filename-encoding~1]
// [impl->req~path-separator-normalization~1]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: i64,
    pub permissions: u32,
}

// [impl->feat~remote-file-browser~1]
// [impl->arch~backend-rust-async~1]
// [impl->req~async-commands-no-block~1]
// [impl->req~file-tree-virtualization~1]
#[command]
pub async fn list_directory(session_id: String, path: String) -> Result<Vec<RemoteFile>, String> {
    let sftp = ssh::get_sftp_session(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;
    let sftp = sftp.lock().await;

    let entries = sftp
        .read_dir(&path)
        .await
        .map_err(|e| format!("SFTP read_dir failed: {e}"))?;

    let mut files = Vec::new();
    for entry in entries {
        let metadata = entry.metadata();
        files.push(RemoteFile {
            name: entry.file_name(),
            path: entry.path(),
            is_directory: metadata.is_dir(),
            size: metadata.size.unwrap_or(0),
            modified: metadata.mtime.map(|t| t as i64).unwrap_or(0),
            permissions: metadata.permissions.unwrap_or(0),
        });
    }

    Ok(files)
}

// [impl->feat~sftp-file-transfer~1]
// [impl->req~large-file-transfer-native~1]
// [impl->req~transfer-progress~1]
#[command]
pub async fn read_file(session_id: String, path: String) -> Result<Vec<u8>, String> {
    let sftp = ssh::get_sftp_session(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;
    let sftp = sftp.lock().await;

    let mut file = sftp
        .open(&path)
        .await
        .map_err(|e| format!("SFTP open failed: {e}"))?;

    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .await
        .map_err(|e| format!("SFTP read failed: {e}"))?;

    // Drop closes the handle fire-and-forget; no need for explicit close on read.
    Ok(buf)
}

// [impl->feat~sftp-file-transfer~1]
// [impl->req~large-file-transfer-native~1]
#[command]
pub async fn download_file(
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let local_path = std::path::PathBuf::from(local_path);
    copy_remote_file_to_local(&session_id, &remote_path, &local_path).await
}

/// Downloads a remote file to the OS temp directory and returns the local temp path.
/// Used for native drag-out operations.
/// Creates a unique subdirectory per file to avoid collisions while preserving the original filename.
#[command]
pub async fn download_file_to_temp(
    session_id: String,
    remote_path: String,
) -> Result<String, String> {
    let file_name = std::path::Path::new(&remote_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download");
    let temp_dir = std::env::temp_dir().join("aether");
    // Create a unique subdirectory for this file to avoid collisions
    let unique_subdir = temp_dir.join(uuid::Uuid::new_v4().to_string());
    tokio::fs::create_dir_all(&unique_subdir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {e}"))?;
    let local_path = unique_subdir.join(file_name);
    copy_remote_file_to_local(&session_id, &remote_path, &local_path).await?;
    Ok(local_path.to_string_lossy().into_owned())
}

/// Read a local file from disk and return its bytes.
/// Used for OS file-drop uploads where the webview cannot access paths directly.
#[command]
pub async fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Read local file failed: {e}"))
}

// [impl->feat~sftp-file-transfer~1]
// [impl->req~large-file-transfer-native~1]
#[command]
pub async fn write_file(session_id: String, path: String, data: Vec<u8>) -> Result<(), String> {
    let sftp = ssh::get_sftp_session(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;
    let sftp = sftp.lock().await;

    let mut file = sftp
        .create(&path)
        .await
        .map_err(|e| format!("SFTP create failed: {e}"))?;

    file.write_all(&data)
        .await
        .map_err(|e| format!("SFTP write failed: {e}"))?;

    file.shutdown()
        .await
        .map_err(|e| format!("SFTP shutdown failed: {e}"))?;

    Ok(())
}
