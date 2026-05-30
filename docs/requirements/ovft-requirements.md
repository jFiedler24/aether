# Open Very Fast Trace Requirements — Aether Remote Terminal

<!-- SPDX-License-Identifier: MIT -->
<!-- Artifact types: feat, req, dsn, arch, impl, utest, itest -->

---

## feat~remote-terminal-app~1

The system shall be a cross-platform remote terminal desktop application for Windows, macOS, and Linux, providing integrated SSH terminal and SFTP file transfer in a single window.

**Needs:** req, arch, dsn, impl, itest
**Tags:** core, desktop

---

## req~app-core~1

The application shall provide integrated SSH terminal and SFTP file transfer functionality in a single desktop window.

**Covers:** feat~remote-terminal-app~1
**Tags:** core

---

## feat~tauri-desktop-shell~1

The application shall use Tauri as the desktop shell, with a Rust backend and a web-technology frontend.

**Needs:** dsn, impl, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** architecture, tauri

---

## feat~ssh-terminal~1

The system shall provide a terminal emulator connected to remote hosts via SSH.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** ssh, terminal

---

## req~terminal-emulation~1

The terminal shall emulate xterm-256color to ensure compatibility with common Unix applications, including color support, cursor styles, and standard escape sequences.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1
**Tags:** terminal, compatibility

---

## req~multiple-terminal-tabs~1

The UI shall support multiple terminal sessions in tabs, allowing the user to switch between concurrent SSH connections.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1
**Tags:** ui, tabs

---

## req~terminal-copy-paste~1

The terminal shall support copying selected text to the system clipboard and pasting from the system clipboard using standard keyboard shortcuts (Ctrl+Shift+C / Ctrl+Shift+V on Windows/Linux, Cmd+C / Cmd+V on macOS) and context-menu actions.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1
**Tags:** clipboard, ux

---

## feat~sftp-file-transfer~1

The system shall provide SFTP-based file transfer, allowing users to browse the remote filesystem and transfer files to and from the local machine.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** sftp, file-transfer

---

## req~drag-drop-upload-download~1

The remote file browser shall support dragging files from the local file manager into the remote file browser to upload, and dragging remote files out to download.

**Needs:** impl, utest
**Covers:** feat~sftp-file-transfer~1
**Tags:** drag-drop, ux

---

## req~transfer-progress~1

File transfers shall display progress indicators (percentage, bytes transferred, estimated time remaining).

**Needs:** impl, utest
**Covers:** feat~sftp-file-transfer~1
**Tags:** ux, progress

---

## feat~remote-file-browser~1

The system shall provide a remote file browser panel displaying the remote filesystem as a navigable tree and/or list, synchronized with the active SSH session's connection.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-terminal-app~1, feat~sftp-file-transfer~1
**Tags:** ui, file-browser

---

## req~file-tree-virtualization~1

The remote file browser tree view shall use virtualized rendering to remain performant when browsing directories containing thousands of files.

**Needs:** impl, utest
**Covers:** feat~remote-file-browser~1
**Tags:** performance, ui

---

## req~remote-file-browser-copy-paste~1

The remote file browser shall support copying selected file names / paths to the system clipboard and pasting paths from the system clipboard into the current directory or path bar.

**Needs:** impl, utest
**Covers:** feat~remote-file-browser~1
**Tags:** clipboard, ux

---

## feat~file-association-tool-mapping~1

The system shall allow configuring a mapping of file extensions to external tools so that double-clicking a remote file opens it locally with the associated application after a temporary download.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-file-browser~1
**Tags:** integration, config

---

## req~tool-mapping-config~1

The tool-to-extension mapping shall be stored in a user-editable configuration file (e.g., JSON or TOML) mapping file extensions (e.g., `.log`, `.conf`) to executable paths and optional arguments.

**Needs:** impl, utest
**Covers:** feat~file-association-tool-mapping~1
**Tags:** config

---

## req~temp-download-on-open~1

When a user opens a remote file via the file association mapping, the application shall download the file to a temporary local directory, open it with the configured tool, and optionally re-upload on save (if supported in a future version) or discard the temp file on application exit.

**Needs:** impl, itest
**Covers:** feat~file-association-tool-mapping~1
**Tags:** sftp, integration

---

## feat~connection-profiles~1

The system shall support storable connection profiles containing host, port, user, authentication method, and display preferences.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** config, profiles

---

## req~profile-fields~1

Each connection profile shall store at minimum: profile name, host address, port (default 22), username, authentication type (password, private-key, or agent), private key path, and a display label/color.

**Needs:** impl, utest
**Covers:** feat~connection-profiles~1
**Tags:** config, profiles

---

## req~profile-encryption~1

Passwords and private-key passphrases stored in profiles shall be encrypted at rest using the OS credential store (e.g., Windows Credential Manager, macOS Keychain, Linux libsecret) or a Tauri-compatible secure storage plugin.

**Needs:** impl, utest
**Covers:** feat~connection-profiles~1
**Tags:** security, credentials

---

## req~profile-import-export~1

Connection profiles (excluding secrets) shall be exportable to and importable from a JSON or TOML file to facilitate backup and team sharing.

**Needs:** impl, utest
**Covers:** feat~connection-profiles~1
**Tags:** config, backup

---

## feat~integrated-layout~1

The application shall display the terminal and remote file browser in a single integrated window with a resizable split-pane layout.

**Needs:** req, dsn, impl, utest
**Covers:** feat~remote-terminal-app~1
**Tags:** ui, layout

---

## req~resizable-panels~1

The terminal panel and file browser panel shall be separated by a draggable splitter allowing the user to adjust the relative size of each panel.

**Needs:** impl, utest
**Covers:** feat~integrated-layout~1
**Tags:** ui, layout

---

## req~toggle-file-browser~1

The user shall be able to show or hide the remote file browser panel via a toolbar button or keyboard shortcut, giving full width to the terminal when desired.

**Needs:** impl, utest
**Covers:** feat~integrated-layout~1
**Tags:** ui, layout

---

## feat~windows-primary-target~1

The application shall be developed with Windows as the primary target platform, ensuring native Windows behaviors, installer packaging, and HiDPI support, while remaining cross-platform compatible.

**Needs:** req, dsn, impl, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** windows, packaging

---

## req~windows-installer~1

The build pipeline shall produce a Windows installer (MSI or NSIS) and a portable `.exe` as distribution artifacts.

**Needs:** impl, itest
**Covers:** feat~windows-primary-target~1
**Tags:** packaging, windows

---

## arch~backend-rust-async~1

The Rust backend shall use asynchronous I/O (tokio) for all SSH and SFTP operations to prevent blocking the Tauri event loop.

**Needs:** impl, utest
**Covers:** feat~tauri-desktop-shell~1, feat~ssh-terminal~1, feat~sftp-file-transfer~1
**Tags:** architecture, async

---

## arch~ssh-library~1

The Rust backend shall use the `russh` crate (or an equivalent maintained async SSH library) for SSH protocol handling and `russh-sftp` for SFTP operations.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1, feat~sftp-file-transfer~1
**Tags:** architecture, dependencies

---

## arch~frontend-framework~1

The frontend shall be built with a modern web framework (e.g., React, Vue, or Svelte) compiled to static assets served by the Tauri shell.

**Needs:** impl, itest
**Covers:** feat~tauri-desktop-shell~1
**Tags:** architecture, frontend

---

## dsn~file-tree-component~1

The remote file browser shall use a virtualized tree component for rendering the directory structure. The recommended options are:
- **react-arborist** (React) — purpose-built for file trees, supports virtualization, drag-and-drop, inline renaming, and multi-selection.
- **TanStack Virtual + headless tree** (framework-agnostic) — maximum control, lightweight, but requires custom drag/drop and selection logic.
- **AG Grid Tree View** (React/Vue/Plain) — enterprise-grade, but potentially heavier than needed.

The primary recommendation is **react-arborist** for rapid development and built-in file-tree UX patterns.

**Needs:** impl, utest
**Covers:** feat~remote-file-browser~1, req~file-tree-virtualization~1
**Tags:** design, ui, dependencies

---

## dsn~terminal-component~1

The terminal frontend shall use `xterm.js` embedded in a Tauri WebView, communicating with the Rust backend via Tauri events / WebSocket for PTY data.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1, req~terminal-emulation~1
**Tags:** design, ui, dependencies

---

## dsn~state-sync~1

The Rust backend shall maintain a per-connection state object (SSH channel + SFTP session) and expose Tauri commands for the frontend to list directories, transfer files, and send/receive terminal data.

**Needs:** impl, utest
**Covers:** feat~ssh-terminal~1, feat~sftp-file-transfer~1, feat~remote-file-browser~1
**Tags:** design, state-management

---

## feat~pitfalls-and-constraints~1

The system design and implementation shall explicitly address known technical pitfalls of Tauri-based remote terminal applications to ensure stability, performance, and correct cross-platform behavior.

**Needs:** req, dsn, impl, utest, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** pitfalls, constraints, quality

---

## req~terminal-stream-not-invoke~1

Terminal PTY data shall be transmitted via Tauri events or a WebSocket stream, not through Tauri `invoke` commands. Using request/response patterns for bidirectional terminal I/O causes latency, buffering issues, and dropped escape sequences.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1
**Tags:** tauri, streaming, performance

---

## req~large-file-transfer-native~1

File transfers shall be handled entirely in the Rust backend with progress emitted as Tauri events. File contents shall never pass through the Tauri JavaScript bridge as base64 or byte arrays to avoid memory exhaustion and payload-size limits.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~sftp-file-transfer~1
**Tags:** tauri, memory, performance

---

## req~windows-webview-clipboard~1

On Windows, clipboard access inside the WebView2-hosted xterm.js terminal shall be explicitly tested and, if standard browser clipboard APIs fail, shall use Tauri’s native clipboard plugin as a fallback for copy and paste operations.

**Needs:** dsn, impl, utest
**Covers:** feat~pitfalls-and-constraints~1, req~terminal-copy-paste~1
**Tags:** windows, clipboard, webview2

---

## req~windows-ssh-agent~1

The application shall support Windows-specific SSH authentication methods including Windows OpenSSH Agent, Pageant (PuTTY agent), and explicit private-key files, because Windows lacks a standard Unix-style `ssh-agent` socket by default.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~connection-profiles~1
**Tags:** windows, ssh, authentication

---

## req~shared-connection-lifecycle~1

SFTP sessions shall share the underlying SSH transport with their paired terminal session. The backend shall manage connection state so that SFTP operations fail gracefully when the SSH connection drops, and reconnection restores both terminal and SFTP access.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1, feat~sftp-file-transfer~1
**Tags:** ssh, sftp, state-management

---

## req~native-drag-drop-tauri~1

Drag-and-drop from the native operating system file manager into the remote file browser shall use Tauri’s native drag-drop events (`tauri://drag-drop`), not only HTML5 `dragover`/`drop` events, because WebView security policies often block cross-origin or external drag data.

**Needs:** dsn, impl, utest
**Covers:** feat~pitfalls-and-constraints~1, req~drag-drop-upload-download~1
**Tags:** tauri, drag-drop, webview

---

## req~async-commands-no-block~1

All Tauri commands that perform network or filesystem I/O (SSH connect, SFTP list, file transfer) shall be declared as `async` and run on a tokio thread pool. Synchronous blocking calls in Tauri command handlers freeze the entire application window.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, arch~backend-rust-async~1
**Tags:** tauri, async, performance

---

## req~xterm-fit-on-resize~1

The frontend shall invoke `xterm.fit()` (or the addon equivalent) and emit the new terminal dimensions to the Rust backend whenever the terminal panel is resized. Failure to do so causes `vim`, `htop`, and other TUI applications to render with incorrect dimensions.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1, feat~integrated-layout~1
**Tags:** terminal, resize, ux

---

## req~sigwinch-forwarding~1

When the terminal dimensions change, the Rust backend shall forward the new size to the remote PTY via SSH so that the remote shell receives `SIGWINCH` and applications can redraw correctly.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1
**Tags:** ssh, terminal, pty

---

## req~temp-file-cleanup~1

Temporary files created for remote file opening shall be stored in the OS temp directory under an application-specific subdirectory and cleaned up on application exit. A startup cleanup routine shall remove orphaned temp files from previous crashes.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, req~temp-download-on-open~1
**Tags:** filesystem, cleanup, reliability

---

## req~sftp-filename-encoding~1

The SFTP implementation shall correctly handle non-ASCII filenames (UTF-8 and legacy encodings) to ensure that remote directories containing international characters are listed, transferred, and opened without mojibake or errors.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~remote-file-browser~1
**Tags:** sftp, encoding, i18n

---

## req~connection-isolation~1

Each terminal tab shall maintain its own independent SSH connection state object in the Rust backend, identified by a unique session ID. Leaking state between tabs shall be prevented to avoid cross-talk of terminal output or file listings.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1, feat~remote-file-browser~1
**Tags:** state-management, tabs, isolation

---

## req~path-separator-normalization~1

All remote paths displayed and used in SFTP operations shall use forward slashes (`/`). Local Windows paths used for downloads shall be converted appropriately. The UI shall never present mixed or incorrect path separators to the user.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~sftp-file-transfer~1
**Tags:** windows, paths, ux

---

## req~graceful-reconnect~1

When an SSH connection drops unexpectedly, the application shall detect the disconnect, notify the user, and provide a reconnect action that reuses the connection profile without requiring re-entry of credentials.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, feat~ssh-terminal~1
**Tags:** ssh, reliability, ux

---

## req~no-plaintext-secrets~1

Passwords and private-key passphrases shall never be stored in localStorage, plain JSON files, or logged to console. This is a reinforcement of the secure-storage requirement to prevent a common Tauri/webview pitfall.

**Needs:** impl, utest
**Covers:** feat~pitfalls-and-constraints~1, req~profile-encryption~1
**Tags:** security, credentials, tauri

---

## feat~standard-ssh-gateway~1

The system shall make managed connection profiles accessible to standard SSH ecosystem tools (`ssh`, `scp`, `sftp`, `rsync`) by generating OpenSSH-compatible configuration and providing a credential-injection proxy. External tools, scripts, and AI agents shall use familiar standard commands without learning a custom CLI.

**Needs:** req, dsn, arch, impl, utest, itest
**Covers:** feat~remote-terminal-app~1
**Tags:** ssh, automation, ai-integration, gateway

---

## req~ssh-config-generation~1

The application shall generate and maintain OpenSSH-compatible `Host` entries for each connection profile, writing to a user-configurable path (default: `~/.ssh/config.d/aether`). Each entry shall include `HostName`, `User`, `Port`, and `IdentityFile` (or `ProxyCommand` for credential injection).

**Needs:** impl, utest
**Covers:** feat~standard-ssh-gateway~1, feat~connection-profiles~1
**Tags:** ssh, config, automation

---

## req~credential-proxy~1

For password-based or passphrase-protected key profiles, the application shall provide an `aether-ssh-proxy` binary that acts as an SSH `ProxyCommand`. It shall fetch credentials from the OS secure store and transparently authenticate the standard SSH client without exposing secrets to AI tools or shell history.

**Needs:** impl, utest
**Covers:** feat~standard-ssh-gateway~1, feat~connection-profiles~1, req~profile-encryption~1
**Tags:** ssh, security, proxy, credentials

---

## req~ssh-config-auto-update~1

The generated SSH configuration shall be automatically updated when profiles are created, edited, or deleted in the GUI. A reload mechanism (e.g., touching the config file or notifying the user) shall ensure running shells pick up changes.

**Needs:** impl, utest
**Covers:** feat~standard-ssh-gateway~1
**Tags:** ssh, config, sync

---

## req~ai-standard-command-compatibility~1

Because AI models are universally trained on standard POSIX tools, the system shall not require AI agents to learn custom subcommands. `ssh <profile>`, `scp <file> <profile>:<path>`, `rsync ... <profile>:...`, and `sftp <profile>` shall all work using profiles managed by the application.

**Needs:** impl, itest
**Covers:** feat~standard-ssh-gateway~1
**Tags:** ai-integration, ssh, compatibility

---

## feat~cli-management~1

The system shall provide a lightweight `aether` CLI for application-specific management tasks — profile listing, SSH config export, connection monitoring, and advanced sync operations — while intentionally NOT replacing standard `ssh`/`scp`/`sftp` for core remote operations.

**Needs:** req, dsn, impl, utest
**Covers:** feat~remote-terminal-app~1
**Tags:** cli, management

---

## req~cli-profiles-list~1

The `aether` CLI shall provide a `profiles list` subcommand that prints stored connection profiles in human-readable and `--json` formats, enabling scripting and AI tool discovery of available hosts.

**Needs:** impl, utest
**Covers:** feat~cli-management~1
**Tags:** cli, profiles, automation

---

## req~cli-export-ssh-config~1

The `aether` CLI shall provide an `export-ssh-config` subcommand that prints or writes the OpenSSH configuration derived from application profiles, allowing users to source it manually or integrate it into their dotfiles.

**Needs:** impl, utest
**Covers:** feat~cli-management~1, feat~standard-ssh-gateway~1
**Tags:** cli, ssh, config

---

## req~cli-monitor~1

The `aether` CLI shall provide a `monitor` subcommand that displays live connection status, active tunnels, and transfer progress for running GUI sessions, acting as a read-only window into the application's runtime state.

**Needs:** impl, utest
**Covers:** feat~cli-management~1
**Tags:** cli, monitoring

---

## req~cli-shell-completions~1

The `aether` CLI shall generate shell completions (bash, zsh, PowerShell, fish) via a `completions` subcommand or build artifact, ensuring discoverability for management commands.

**Needs:** impl, utest
**Covers:** feat~cli-management~1
**Tags:** cli, documentation, ux

---

## req~cli-documentation~1

The `aether` CLI shall provide comprehensive built-in help (`--help` for each subcommand) and a man page, clearly distinguishing between standard SSH workflows (preferred) and app-specific management commands.

**Needs:** impl, utest
**Covers:** feat~cli-management~1
**Tags:** cli, documentation, ux

---

## req~windows-openssh-detection~1

The application shall detect the presence of the Windows OpenSSH Client (`ssh.exe`, `scp.exe`, `sftp.exe`) on startup. If missing, it shall display a guided prompt to enable it via Windows Optional Features or provide a direct link to the Microsoft installation documentation.

**Needs:** impl, utest
**Covers:** feat~windows-primary-target~1, feat~standard-ssh-gateway~1
**Tags:** windows, ssh, prerequisites

---

## req~rsync-native-sync~1

Because `rsync` is not natively available on Windows, the `aether` CLI shall provide a built-in `sync` command using the application's SFTP layer. It shall support delta transfer (file comparison by size and modification time), progress display, and `--delete` semantics compatible with common `rsync` workflows.

**Needs:** impl, utest
**Covers:** feat~cli-management~1, feat~sftp-file-transfer~1
**Tags:** windows, sftp, sync, cli

---

## req~rsync-shim-optional~1

The application shall optionally install an `rsync` shim (e.g., a small wrapper executable or shell alias) that routes `rsync` invocations to the native `aether sync` implementation. This shall be opt-in during installation or via an explicit `aether install-shim` command.

**Needs:** impl, utest
**Covers:** feat~standard-ssh-gateway~1, req~rsync-native-sync~1
**Tags:** windows, sync, compatibility, ai-integration

---

# Glossary

| Term | Definition |
|------|------------|
| Tauri | Framework for building tiny, fast desktop apps with a Rust backend and Web frontend. |
| xterm.js | A terminal front-end component written in JavaScript that works in the browser. |
| react-arborist | A React library for building file trees and sortable, virtualized lists. |
| russh | An async SSH client (and server) library written in Rust. |
| OVFT | Open Very Fast Trace — requirements tracing methodology and tooling. |
