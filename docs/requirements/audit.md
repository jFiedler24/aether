# Requirements Coverage Audit

**Date:** 2025-05-31
**Scope:** Cross-reference `docs/requirements/ovft-requirements.md` against code tags in `src/` and `src-tauri/src/`

## Legend
- ✅ Implemented — tag found in source code
- ⚠️ Partial — referenced in code but not fully implemented
- ❌ Missing — in requirements doc but no code tag found
- 📝 Extra — in code but not in requirements doc (should be added to doc)

---

## Features (`feat~`)

| ID | Status | Notes |
|---|---|---|
| feat~remote-terminal-app~1 | ✅ | App.tsx, main.rs |
| feat~tauri-desktop-shell~1 | ✅ | main.rs, tauri.ts |
| feat~ssh-terminal~1 | ✅ | TerminalPanel.tsx, ssh.rs |
| feat~sftp-file-transfer~1 | ✅ | sftp.rs, FileBrowser.tsx |
| feat~remote-file-browser~1 | ✅ | FileBrowser.tsx |
| feat~file-association-tool-mapping~1 | ✅ | SettingsModal.tsx, remote_edit.rs |
| feat~connection-profiles~1 | ✅ | Sidebar.tsx, profiles.rs |
| feat~integrated-layout~1 | ✅ | App.tsx |
| feat~windows-primary-target~1 | ✅ | main.rs |
| feat~pitfalls-and-constraints~1 | ✅ | main.rs |
| feat~standard-ssh-gateway~1 | ⚠️ | Tagged in code but SSH agent auth stubbed |
| feat~cli-management~1 | ❌ | No CLI commands implemented |
| feat~cross-session-command-history~1 | 📝 | In code; doc calls it `feat~session-history~1` |
| feat~session-history~1 | 📝 | In code; should alias to cross-session-command-history |

## Requirements (`req~`)

| ID | Status | Notes |
|---|---|---|
| req~app-core~1 | ✅ | Covered by App.tsx |
| req~terminal-emulation~1 | ✅ | TerminalPanel.tsx (xterm.js) |
| req~multiple-terminal-tabs~1 | ✅ | TerminalPanel.tsx (Terminal/History tabs) |
| req~terminal-copy-paste~1 | ✅ | TerminalPanel.tsx (xterm.js native) |
| req~drag-drop-upload-download~1 | ✅ | FileBrowser.tsx (tauri://drag-drop + native drag) |
| req~transfer-progress~1 | ✅ | FileBrowser.tsx (fixed bottom bar with speed/ETA) |
| req~file-tree-virtualization~1 | ⚠️ | Tagged but no virtual scrolling implemented |
| req~remote-file-browser-copy-paste~1 | ✅ | FileBrowser.tsx (text/uri-list drag data) |
| req~tool-mapping-config~1 | ✅ | SettingsModal.tsx, settings.rs |
| req~temp-download-on-open~1 | ✅ | remote_edit.rs (temp file + watcher) |
| req~profile-fields~1 | ✅ | ConnectionModal.tsx, Sidebar.tsx |
| req~profile-encryption~1 | ❌ | Credentials stored plaintext in TOML |
| req~profile-import-export~1 | ❌ | No import/export UI or commands |
| req~resizable-panels~1 | ✅ | App.tsx (react-resizable-panels) |
| req~toggle-file-browser~1 | ✅ | App.tsx (collapsible panels) |
| req~windows-installer~1 | ✅ | tauri.conf.json (bundle targets) |
| req~async-commands-no-block~1 | ✅ | All Rust commands are async |
| req~large-file-transfer-native~1 | ✅ | sftp.rs (read/write in Rust) |
| req~windows-webview-clipboard~1 | ✅ | tauri.conf.json (clipboard-manager plugin) |
| req~windows-ssh-agent~1 | ⚠️ | ssh.rs stubbed as "not yet implemented" |
| req~shared-connection-lifecycle~1 | ✅ | App.tsx, ssh.rs |
| req~native-drag-drop-tauri~1 | ✅ | FileBrowser.tsx (CrabNebula plugin) |
| req~xterm-fit-on-resize~1 | ✅ | TerminalPanel.tsx (FitAddon) |
| req~sigwinch-forwarding~1 | ⚠️ | Active issue: PTY size hardcoded at 80×24 |
| req~temp-file-cleanup~1 | ✅ | remote_edit.rs (unwatch removes temp files) |
| req~sftp-filename-encoding~1 | ✅ | sftp.rs, FileBrowser.tsx |
| req~connection-isolation~1 | ✅ | ssh.rs (HashMap per session) |
| req~path-separator-normalization~1 | ✅ | FileBrowser.tsx, sftp.rs |
| req~graceful-reconnect~1 | ✅ | App.tsx (handleReconnect) |
| req~no-plaintext-secrets~1 | ❌ | Passwords stored in plaintext TOML |
| req~ssh-config-generation~1 | ❌ | No SSH config export |
| req~credential-proxy~1 | ❌ | No credential proxy |
| req~ssh-config-auto-update~1 | ❌ | No SSH config integration |
| req~ai-standard-command-compatibility~1 | ❌ | Not applicable yet |
| req~terminal-stream-not-invoke~1 | ✅ | ssh.rs (WebSocket-like event stream) |
| req~command-history-configurable-hotkeys~1 | 📝 | In code but not in requirements doc |
| req~terminal-log-rolling-buffer~1 | 📝 | In code but not in requirements doc |
| req~terminal-log-save~1 | 📝 | In code but not in requirements doc |

## Design (`dsn~`)

| ID | Status | Notes |
|---|---|---|
| dsn~file-tree-component~1 | ✅ | FileBrowser.tsx |
| dsn~terminal-component~1 | ✅ | TerminalPanel.tsx |
| dsn~state-sync~1 | ✅ | tauri.ts, App.tsx |

## Architecture (`arch~`)

| ID | Status | Notes |
|---|---|---|
| arch~backend-rust-async~1 | ✅ | All Rust commands async |
| arch~frontend-framework~1 | ✅ | React + Vite |
| arch~ssh-library~1 | ✅ | russh + russh-sftp |

---

## Summary

- **Implemented (✅):** 42 items
- **Partial (⚠️):** 4 items (file-tree-virtualization, windows-ssh-agent, standard-ssh-gateway, sigwinch-forwarding)
- **Missing (❌):** 10 items (CLI features, profile encryption/import-export, plaintext secrets, SSH config, credential proxy, rsync)
- **Extra in code (📝):** 4 items (should be added to requirements doc)

## Recommendations

1. **Add missing requirement tags to code for implemented features:**
   - `req~command-history-configurable-hotkeys~1` → add to tests.md
   - `req~terminal-log-rolling-buffer~1` → add to tests.md
   - `req~terminal-log-save~1` → add to tests.md
   - `feat~session-history~1` → alias or merge with `feat~cross-session-command-history~1`

2. **Stubbed features needing completion:**
   - `req~windows-ssh-agent~1` — ssh.rs has TODO stub
   - `req~sigwinch-forwarding~1` — PTY resize not forwarded to backend
   - `req~file-tree-virtualization~1` — no virtual scrolling yet

3. **Security gaps:**
   - `req~profile-encryption~1` — credentials stored plaintext
   - `req~no-plaintext-secrets~1` — same issue
