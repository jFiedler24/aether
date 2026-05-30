// [impl->req~profile-fields~1]
export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  // [impl->req~profile-fields~1]
  // Username is preserved case-sensitive; no normalization applied.
  username: string;
  authType: "password" | "key" | "agent";
  privateKeyPath?: string;
  // [impl->req~profile-fields~1]
  password?: string;
  color: string;
}

export interface Session {
  id: string;
  profile: ConnectionProfile;
  status: "connecting" | "connected" | "error" | "closed";
  error?: string;
}

// [impl->feat~remote-file-browser~1]
export interface RemoteFile {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number;
  permissions: number;
}

export interface HistoryEntry {
  id: string;
  profileId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  color: string;
  connectedAt: string;
  password?: string;
  privateKeyPath?: string;
}
