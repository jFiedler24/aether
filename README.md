# Aether

A modern remote terminal application for Windows, macOS, and Linux — inspired by MobaXterm.

![Aether Screenshot](screenshot.png)

## Features

- **Integrated SSH Terminal** — Full xterm-256color emulation powered by xterm.js
- **SFTP File Browser** — Browse, upload, and download files alongside your terminal
- **Connection Profiles** — Save and manage SSH connections with secure credential storage
- **Resizable Split Layout** — Drag to resize terminal and file browser panels
- **AI-Ready CLI** — Standard SSH gateway for AI tools and scripts
- **Windows First** — Native Windows installer (MSI/NSIS) and portable executable

## Tech Stack

- **Backend**: Rust + Tauri + tokio + russh (async SSH)
- **Frontend**: React + TypeScript + xterm.js + react-arborist
- **CLI**: Rust + clap

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) 20+
- Windows: Enable OpenSSH Client (Settings > Apps > Optional Features)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### CLI Usage

```bash
# Build CLI
cargo build -p aether-cli --release

# List profiles
./target/release/aether profiles

# Export SSH config for standard tools
./target/release/aether export-ssh-config >> ~/.ssh/config

# Connect via standard SSH (uses generated config)
ssh my-profile
```

## Architecture

```
aether/
├── src/                  # React frontend
│   ├── components/       # Sidebar, Terminal, FileBrowser, ConnectionModal
│   ├── tauri.ts         # Tauri command wrappers
│   └── types.ts         # Shared TypeScript types
├── src-tauri/           # Rust Tauri backend
│   ├── src/
│   │   ├── main.rs      # App entry point
│   │   ├── profiles.rs  # Profile storage (TOML + OS keychain)
│   │   ├── ssh.rs       # SSH session management
│   │   └── sftp.rs      # SFTP file operations
│   └── Cargo.toml
├── crates/
│   └── aether-cli/      # Standalone CLI companion
└── docs/requirements/   # OVFT requirements tracing
```

## License

MIT
# aether
