// [impl->feat~tauri-desktop-shell~1]
// [impl->dsn~state-sync~1]
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionProfile, RemoteFile, HistoryEntry } from "./types";

// [impl->feat~connection-profiles~1]
export async function listProfiles(): Promise<ConnectionProfile[]> {
  return invoke("list_profiles");
}

// [impl->feat~connection-profiles~1]
export async function saveProfile(profile: ConnectionProfile): Promise<void> {
  return invoke("save_profile", { profile });
}

export async function deleteProfile(id: string): Promise<void> {
  return invoke("delete_profile", { id });
}

// [impl->feat~session-history~1]
export async function listHistory(): Promise<HistoryEntry[]> {
  return invoke("list_history");
}

export async function clearHistory(): Promise<void> {
  return invoke("clear_history");
}

// [impl->feat~ssh-terminal~1]
export async function connect(profile: ConnectionProfile): Promise<string> {
  return invoke("connect", { profile });
}

export async function disconnect(sessionId: string): Promise<void> {
  return invoke("disconnect", { sessionId });
}

// [impl->req~terminal-stream-not-invoke~1]
export async function sendData(
  sessionId: string,
  data: number[],
): Promise<void> {
  return invoke("send_data", { sessionId, data });
}

// [impl->feat~remote-file-browser~1]
export async function listDirectory(
  sessionId: string,
  path: string,
): Promise<RemoteFile[]> {
  return invoke("list_directory", { sessionId, path });
}

// [impl->feat~sftp-file-transfer~1]
export async function readFile(
  sessionId: string,
  path: string,
): Promise<number[]> {
  return invoke("read_file", { sessionId, path });
}

// [impl->feat~sftp-file-transfer~1]
export async function writeFile(
  sessionId: string,
  path: string,
  data: number[],
): Promise<void> {
  return invoke("write_file", { sessionId, path, data });
}

// [impl->feat~file-association-tool-mapping~1]
export async function openRemoteFile(
  sessionId: string,
  remotePath: string,
): Promise<string> {
  return invoke("open_remote_file", { sessionId, remotePath });
}

export async function unwatchRemoteFile(localPath: string): Promise<void> {
  return invoke("unwatch_remote_file", { localPath });
}

export async function listWatchedFiles(): Promise<string[]> {
  return invoke("list_watched_files");
}

// [impl->req~terminal-log-save~1]
export async function saveLogDialog(
  data: string,
  defaultName: string,
): Promise<void> {
  return invoke("save_log_dialog", { data, defaultName });
}
