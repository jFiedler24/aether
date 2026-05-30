# Architecture

## arch~app-stack~1

The application follows a Tauri architecture: Rust backend with tokio async runtime, React frontend compiled to static assets, and OS-native packaging.

**Covers:** feat~remote-terminal-app~1, feat~tauri-desktop-shell~1, arch~backend-rust-async~1, arch~frontend-framework~1, feat~pitfalls-and-constraints~1, req~async-commands-no-block~1

## arch~ssh-stack~1

SSH and SFTP operations use the russh ecosystem (russh + russh-sftp) on tokio. The CLI uses the same libraries for direct connections.

**Covers:** feat~ssh-terminal~1, feat~sftp-file-transfer~1, arch~ssh-library~1, feat~pitfalls-and-constraints~1

## arch~gateway-stack~1

The SSH gateway generates OpenSSH config and provides a ProxyCommand wrapper for credential injection, enabling standard tool compatibility.

**Covers:** feat~standard-ssh-gateway~1, arch~backend-rust-async~1, feat~pitfalls-and-constraints~1
