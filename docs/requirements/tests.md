# Test Traceability

## itest~app-launch~1

The application shall launch successfully and render the main window with sidebar, toolbar, and empty state.

**Covers:** feat~remote-terminal-app~1, feat~tauri-desktop-shell~1, arch~frontend-framework~1

## itest~ssh-connect~1

The application shall establish an SSH connection to a test server and display the terminal prompt.

**Covers:** feat~ssh-terminal~1, feat~connection-profiles~1

## itest~sftp-list~1

The application shall list remote directories via SFTP and display files in the file browser panel.

**Covers:** feat~sftp-file-transfer~1, feat~remote-file-browser~1

## itest~file-transfer~1

The application shall upload and download files between local and remote filesystems.

**Covers:** feat~sftp-file-transfer~1, req~drag-drop-upload-download~1, req~transfer-progress~1

## itest~file-assoc~1

The application shall download and open a remote file with the associated local application.

**Covers:** feat~file-association-tool-mapping~1, req~temp-download-on-open~1

## itest~layout~1

The application shall display terminal and file browser in a resizable split pane, and allow toggling the file browser.

**Covers:** feat~integrated-layout~1, req~resizable-panels~1, req~toggle-file-browser~1

## itest~windows~1

The application shall install and run on Windows, detecting OpenSSH client and producing correct installer artifacts.

**Covers:** feat~windows-primary-target~1, req~windows-installer~1, req~windows-openssh-detection~1

## itest~ssh-gateway~1

The aether CLI shall generate valid SSH config and proxy commands that allow standard SSH tools to connect.

**Covers:** feat~standard-ssh-gateway~1, req~ssh-config-generation~1, req~credential-proxy~1, req~ai-standard-command-compatibility~1

## itest~cli~1

The aether CLI shall list profiles, export SSH config, and display connection status correctly.

**Covers:** feat~cli-management~1, req~cli-profiles-list~1, req~cli-export-ssh-config~1, req~cli-monitor~1

## itest~pitfalls~1

The application shall handle edge cases: terminal resize, connection drops, large file transfers, and clipboard fallback.

**Covers:** feat~pitfalls-and-constraints~1, req~xterm-fit-on-resize~1, req~graceful-reconnect~1, req~large-file-transfer-native~1, req~windows-webview-clipboard~1, req~native-drag-drop-tauri~1

---

## utest~profiles~1

Unit tests for profile serialization, required fields, and import/export round-trip.

**Covers:** feat~connection-profiles~1, req~profile-fields~1, req~profile-import-export~1, req~profile-encryption~1

## utest~ssh-session~1

Unit tests for SSH session creation, isolation, and reconnect logic.

**Covers:** feat~ssh-terminal~1, req~connection-isolation~1, req~graceful-reconnect~1, req~shared-connection-lifecycle~1

## utest~sftp-ops~1

Unit tests for SFTP directory listing, file read/write, and path normalization.

**Covers:** feat~remote-file-browser~1, req~sftp-filename-encoding~1, req~path-separator-normalization~1, req~file-tree-virtualization~1

## utest~terminal~1

Unit tests for xterm.js theme configuration, fit addon, and clipboard fallback.

**Covers:** feat~ssh-terminal~1, req~terminal-emulation~1, req~xterm-fit-on-resize~1, req~terminal-copy-paste~1, req~windows-webview-clipboard~1

## utest~layout~1

Unit tests for panel state management and file browser toggle.

**Covers:** feat~integrated-layout~1, req~resizable-panels~1, req~toggle-file-browser~1

## utest~file-transfer~1

Unit tests for native file transfer streaming, progress events, and temp file cleanup.

**Covers:** feat~sftp-file-transfer~1, req~large-file-transfer-native~1, req~transfer-progress~1, req~temp-file-cleanup~1

## utest~file-assoc~1

Unit tests for tool mapping config parsing and temp download workflow.

**Covers:** feat~file-association-tool-mapping~1, req~tool-mapping-config~1, req~remote-file-browser-copy-paste~1

## utest~drag-drop~1

Unit tests for native drag-drop event handling in the file browser.

**Covers:** req~drag-drop-upload-download~1, req~native-drag-drop-tauri~1

## utest~cli~1

Unit tests for CLI argument parsing, profile listing, and SSH config generation.

**Covers:** feat~cli-management~1, feat~standard-ssh-gateway~1, req~cli-profiles-list~1, req~cli-export-ssh-config~1, req~cli-monitor~1, req~cli-shell-completions~1, req~cli-documentation~1, req~ssh-config-auto-update~1, req~rsync-native-sync~1, req~rsync-shim-optional~1

## utest~windows~1

Unit tests for Windows-specific auth methods, OpenSSH detection, and installer config.

**Covers:** feat~windows-primary-target~1, req~windows-ssh-agent~1, req~windows-openssh-detection~1, req~windows-installer~1

## utest~arch~1

Unit tests for async command handling and frontend framework integration.

**Covers:** arch~backend-rust-async~1, arch~ssh-library~1, arch~frontend-framework~1
