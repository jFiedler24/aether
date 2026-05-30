use crate::ssh;
use serde::{Deserialize, Serialize};
use tauri::command;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

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
