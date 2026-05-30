# Design Decisions

## dsn~tauri-shell~1

The application uses Tauri v2 as the desktop shell. Rust provides the backend with async tokio I/O. The frontend is React + TypeScript compiled to static assets. Tauri commands bridge frontend and backend.

**Covers:** feat~tauri-desktop-shell~1, feat~remote-terminal-app~1, arch~frontend-framework~1, req~terminal-stream-not-invoke~1, req~xterm-fit-on-resize~1, req~sigwinch-forwarding~1

## dsn~terminal-architecture~1

The terminal uses xterm.js in a Tauri WebView. PTY data streams via Tauri events (not invoke). The FitAddon handles resize. A tab bar in the sidebar manages multiple sessions.

**Covers:** feat~ssh-terminal~1, req~terminal-stream-not-invoke~1, req~xterm-fit-on-resize~1, req~multiple-terminal-tabs~1, req~terminal-copy-paste~1, req~sftp-filename-encoding~1, req~path-separator-normalization~1

## dsn~file-browser-architecture~1

The file browser uses a virtualized scrollable list (not a full tree) for simplicity. Breadcrumbs provide navigation. Files are fetched via async Tauri commands. Double-click opens directories. Context menus trigger SFTP operations.

**Covers:** feat~ssh-terminal~1, feat~sftp-file-transfer~1, feat~remote-file-browser~1, req~shared-connection-lifecycle~1, req~connection-isolation~1

## dsn~clipboard-handling~1

Clipboard operations use Tauri's native clipboard-manager plugin as a fallback
when WebView2 clipboard APIs are unavailable.

**Covers:** req~terminal-copy-paste~1, req~windows-webview-clipboard~1, req~remote-file-browser-copy-paste~1

## dsn~profile-storage~1

Profiles are stored as TOML in the OS config directory.
Credentials use the OS keychain via tauri-plugin-stronghold.

**Covers:** feat~connection-profiles~1, req~profile-fields~1, req~profile-encryption~1, req~profile-import-export~1, req~no-plaintext-secrets~1, req~ssh-config-auto-update~1

## dsn~layout~1

The main window uses react-resizable-panels for a split-pane layout.
The file browser panel can be toggled via toolbar button.

**Covers:** feat~integrated-layout~1, req~resizable-panels~1, req~toggle-file-browser~1

## dsn~file-transfer~1

File transfers are handled entirely in Rust backend with progress emitted as events.
No file data passes through the JavaScript bridge.

**Covers:** feat~sftp-file-transfer~1, req~large-file-transfer-native~1, req~transfer-progress~1, req~drag-drop-upload-download~1, req~native-drag-drop-tauri~1, req~temp-download-on-open~1, req~temp-file-cleanup~1

## dsn~ssh-gateway~1

The CLI generates OpenSSH-compatible config entries and provides a ProxyCommand
for credential injection.

**Covers:** feat~standard-ssh-gateway~1, req~ssh-config-generation~1, req~credential-proxy~1, req~ai-standard-command-compatibility~1

## dsn~cli-management~1

The aether CLI provides profile listing, SSH config export, and monitoring.
It reads from the same TOML config as the GUI.

**Covers:** feat~cli-management~1, req~cli-profiles-list~1, req~cli-export-ssh-config~1, req~cli-monitor~1, req~cli-shell-completions~1, req~cli-documentation~1

## dsn~windows-toolchain~1

On Windows, the app detects OpenSSH client availability and provides a native
rsync alternative via the aether sync command.

**Covers:** feat~windows-primary-target~1, req~windows-installer~1, req~windows-openssh-detection~1, req~rsync-native-sync~1, req~rsync-shim-optional~1

## dsn~windows-ssh-auth~1

The connection dialog supports password, key file, and SSH agent authentication
to accommodate Windows users.

**Covers:** req~windows-ssh-agent~1

## dsn~reconnect~1

When a connection drops, the backend detects it and the frontend shows a
reconnect option using the stored profile.

**Covers:** req~graceful-reconnect~1

## dsn~tabs~1

Multiple terminal sessions are displayed as tabs in the sidebar.
Each tab maintains independent state.

**Covers:** req~multiple-terminal-tabs~1

## dsn~file-assoc~1

Remote file opening uses a configurable mapping of extensions to local tools.
Files are downloaded to a temp directory and opened with the associated application.

**Covers:** feat~file-association-tool-mapping~1, req~tool-mapping-config~1
**Covers:** feat~remote-file-browser~1, req~file-tree-virtualization~1, req~remote-file-browser-copy-paste~1, req~drag-drop-upload-download~1, req~native-drag-drop-tauri~1

## dsn~sftp-backend~1

SFTP operations use russh-sftp on the async tokio runtime. File transfers stream directly in Rust with progress events sent to the frontend. No file data passes through the JavaScript bridge.

**Covers:** feat~sftp-file-transfer~1, req~large-file-transfer-native~1, req~transfer-progress~1, req~shared-connection-lifecycle~1

## dsn~profile-storage-design~1

Profiles store as TOML in the OS config directory. Credentials use the OS keychain via Tauri stronghold plugin. Passwords never touch localStorage or plain files.

**Covers:** feat~connection-profiles~1, req~profile-fields~1, req~profile-encryption~1, req~profile-import-export~1, req~no-plaintext-secrets~1

## dsn~layout-design~1

The main window uses react-resizable-panels for a persistent split layout. The file browser can be toggled via toolbar button. Panel proportions are not persisted across sessions (future enhancement).

**Covers:** feat~integrated-layout~1, req~resizable-panels~1, req~toggle-file-browser~1

## dsn~file-assoc-design~1

Remote file opening uses a JSON/TOML config mapping extensions to local executables. Files download to OS temp, open via OS shell, and clean up on app exit. Re-upload on save is deferred to a future version.

**Covers:** feat~file-association-tool-mapping~1, req~tool-mapping-config~1, req~temp-download-on-open~1, req~temp-file-cleanup~1

## dsn~windows-target~1

Windows is the primary target. The build produces MSI (via Tauri bundler) and a portable exe. OpenSSH client detection checks for ssh.exe in PATH. WebView2 clipboard fallback uses Tauri's clipboard plugin.

**Covers:** feat~windows-primary-target~1, req~windows-installer~1, req~windows-openssh-detection~1, req~windows-webview-clipboard~1

## dsn~ssh-gateway-design~1

The CLI reads profiles from the shared TOML config and generates OpenSSH Host entries. The aether-ssh-proxy binary fetches credentials from the OS keychain and pipes them to OpenSSH via ProxyCommand.

**Covers:** feat~standard-ssh-gateway~1, req~ssh-config-generation~1, req~credential-proxy~1, req~ssh-config-auto-update~1, req~ai-standard-command-compatibility~1

## dsn~cli-design~1

The aether CLI uses clap for argument parsing. Subcommands: profiles, export-ssh-config, connect, exec, cp, tunnel. Shell completions generated at build time via clap_complete.

**Covers:** feat~cli-management~1, req~cli-profiles-list~1, req~cli-export-ssh-config~1, req~cli-monitor~1, req~cli-shell-completions~1, req~cli-documentation~1, req~rsync-native-sync~1, req~rsync-shim-optional~1

## dsn~pitfalls-design~1

Known Tauri pitfalls are addressed: async commands prevent UI freezing, terminal data streams via events, SFTP handles UTF-8 filenames, paths normalize to forward slashes, connections are isolated per tab, and disconnects are detected with reconnect prompts.

**Covers:** feat~pitfalls-and-constraints~1, req~async-commands-no-block~1, req~sftp-filename-encoding~1, req~path-separator-normalization~1, req~connection-isolation~1, req~graceful-reconnect~1, req~sigwinch-forwarding~1, req~windows-ssh-agent~1

## dsn~app-design~1

The application is a single-window desktop app integrating terminal, file browser, and connection management. State is managed per-session in Rust with UUID keys. The frontend renders session-specific UI based on active session ID.

**Covers:** feat~remote-terminal-app~1, dsn~state-sync~1
