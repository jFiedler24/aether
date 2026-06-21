use crate::profiles::Profile;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use tauri::command;
use tauri::Emitter;
use tokio::sync::mpsc;

// Re-export for sftp module
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub profile_id: String,
    pub connected: bool,
}

// [impl->feat~ssh-terminal~1]
// [impl->arch~ssh-library~1]
// [impl->req~connection-isolation~1]
// [impl->req~shared-connection-lifecycle~1]
// [impl->req~async-commands-no-block~1]

/// SSH client handler that validates server keys against known_hosts.
// [impl->feat~standard-ssh-gateway~1]
struct SshClient {
    host: String,
    port: u16,
}

impl russh::client::Handler for SshClient {
    type Error = russh::Error;

    // [impl->feat~standard-ssh-gateway~1]
    // Enforce known_hosts verification to prevent silent MITM acceptance.
    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        match russh::keys::check_known_hosts(&self.host, self.port, server_public_key) {
            Ok(true) => Ok(true),
            Ok(false) => {
                eprintln!(
                    "[aether ssh] unknown host key for {}:{}; add it to known_hosts before connecting",
                    self.host, self.port
                );
                Ok(false)
            }
            Err(err) => {
                eprintln!(
                    "[aether ssh] known_hosts validation failed for {}:{}: {}",
                    self.host, self.port, err
                );
                Ok(false)
            }
        }
    }
}

// [impl->dsn~state-sync~1]
// [impl->req~connection-isolation~1]
pub struct SessionState {
    pub profile_id: String,
    pub connected: bool,
    // [impl->req~profile-fields~1]
    pub password: Option<String>,
    pub tx: mpsc::UnboundedSender<Vec<u8>>,
    pub task_handle: tokio::task::JoinHandle<()>,
    // [impl->feat~remote-file-browser~1]
    pub sftp: Option<Arc<tokio::sync::Mutex<russh_sftp::client::SftpSession>>>,
}

impl std::fmt::Debug for SessionState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SessionState")
            .field("profile_id", &self.profile_id)
            .field("connected", &self.connected)
            .field("password", &self.password.is_some())
            .field("tx", &self.tx)
            .field("task_handle", &self.task_handle)
            .field("sftp", &self.sftp.is_some())
            .finish()
    }
}

// [impl->req~connection-isolation~1]
static SESSIONS: LazyLock<Mutex<HashMap<String, SessionState>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Expand `~` to the user's home directory.
pub(crate) fn expand_tilde(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path)
}

/// Detect a default SSH private key in the user's `.ssh` directory.
/// On Windows, checks `%USERPROFILE%\.ssh\`; on Unix, checks `~/.ssh/`.
/// Prefers ed25519, then rsa, then ecdsa.
// [impl->req~windows-openssh-detection~1]
fn detect_default_ssh_key() -> Option<PathBuf> {
    let ssh_dir = dirs::home_dir()?.join(".ssh");
    if !ssh_dir.is_dir() {
        return None;
    }
    let candidates = ["id_ed25519", "id_rsa", "id_ecdsa"];
    for name in &candidates {
        let path = ssh_dir.join(name);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

// [impl->feat~ssh-terminal~1]
// [impl->arch~backend-rust-async~1]
// [impl~req~async-commands-no-block~1]
// [impl->req~shared-connection-lifecycle~1]
#[command]
pub async fn connect(
    session_id: String,
    profile: Profile,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let config = Arc::new(russh::client::Config {
        inactivity_timeout: Some(Duration::from_secs(30)),
        ..Default::default()
    });

    let addrs = (profile.host.as_str(), profile.port);

    // [impl->feat~standard-ssh-gateway~1]
    // Connect with strict known_hosts verification.
    let mut handle = russh::client::connect(
        config,
        addrs,
        SshClient {
            host: profile.host.clone(),
            port: profile.port,
        },
    )
        .await
        .map_err(|e| format!("SSH connection failed: {e}"))?;

    // Authenticate
    // [impl->req~windows-ssh-agent~1]
    let auth_result = match profile.auth_type.as_str() {
        "password" => {
            let password = profile.password.as_ref().ok_or("Password not provided")?;
            handle
                .authenticate_password(profile.username.clone(), password.clone())
                .await
                .map_err(|e| format!("Auth error: {e}"))?
        }
        "key" => {
            // [impl->req~windows-openssh-detection~1]
            // If no key path is given, try to auto-detect a default SSH key.
            let key_path = match profile.private_key_path.as_ref() {
                Some(p) if !p.is_empty() => expand_tilde(p),
                _ => detect_default_ssh_key()
                    .ok_or("No private key path provided and no default SSH key found. \
                           Please specify a key path or ensure a default key exists \
                           (e.g. ~/.ssh/id_ed25519 on Unix or %USERPROFILE%\\.ssh\\id_ed25519 on Windows).")?,
            };
            let key = russh::keys::load_secret_key(&key_path, None)
                .map_err(|e| format!("Key load error for '{}': {e}", key_path.display()))?;
            let key_with_hash = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
            handle
                .authenticate_publickey(profile.username.clone(), key_with_hash)
                .await
                .map_err(|e| format!("Auth error: {e}"))?
        }
        "agent" => {
            // [impl->req~windows-ssh-agent~1]
            return Err("SSH agent authentication is not yet implemented. \
                       On Windows, please use a private key file instead, \
                       or ensure your key is in a default location for auto-detection."
                .to_string());
        }
        _ => return Err(format!("Unknown auth type: {}", profile.auth_type)),
    };

    if auth_result != russh::client::AuthResult::Success {
        return Err("Authentication failed".to_string());
    }

    // [impl->feat~session-history~1]
    // Persist successful connection to history.
    let _ = crate::history::add_history_entry(&profile).await;

    // Open interactive channel
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Channel open failed: {e}"))?;

    // Open SFTP subsystem on a second channel BEFORE starting the shell,
    // so the I/O loop can be spawned immediately after the shell request
    // and no initial shell output is lost during SFTP handshake.
    // [impl->feat~remote-file-browser~1]
    let sftp_session = {
        let sftp_channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("SFTP channel open failed: {e}"))?;
        sftp_channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("SFTP subsystem request failed: {e}"))?;
        russh_sftp::client::SftpSession::new(sftp_channel.into_stream())
            .await
            .map_err(|e| format!("SFTP session init failed: {e}"))?
    };

    // Request PTY (default 80×24, TODO: forward actual xterm size)
    println!("[aether ssh] Requesting PTY for session {}", session_id);
    channel
        .request_pty(true, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .map_err(|e| format!("PTY request failed: {e}"))?;
    println!("[aether ssh] PTY requested for session {}", session_id);

    println!("[aether ssh] Requesting shell for session {}", session_id);
    channel
        .request_shell(true)
        .await
        .map_err(|e| format!("Shell request failed: {e}"))?;
    println!("[aether ssh] Shell requested for session {}", session_id);

    // Create communication channel for frontend → SSH
    let (tx, rx) = mpsc::unbounded_channel::<Vec<u8>>();

    // Spawn I/O loop immediately after shell request so no prompt data is lost
    println!("[aether ssh] Spawning I/O loop for session {}", session_id);
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    let task_handle = tokio::spawn(ssh_io_loop(
        handle,
        channel,
        app_clone,
        session_id_clone,
        rx,
    ));
    println!("[aether ssh] I/O loop spawned for session {}", session_id);

    {
        let mut sessions = SESSIONS
            .lock()
            .map_err(|e| format!("Mutex poisoned: {e}"))?;
        sessions.insert(
            session_id.clone(),
            SessionState {
                profile_id: profile.id,
                connected: true,
                password: profile.password,
                tx,
                task_handle,
                sftp: Some(Arc::new(tokio::sync::Mutex::new(sftp_session))),
            },
        );
    }

    println!(
        "[aether ssh] connect() returning Ok for session {}",
        session_id
    );
    Ok(session_id)
}

async fn ssh_io_loop(
    handle: russh::client::Handle<SshClient>,
    mut channel: russh::Channel<russh::client::Msg>,
    app: tauri::AppHandle,
    session_id: String,
    mut rx: mpsc::UnboundedReceiver<Vec<u8>>,
) {
    println!("[aether ssh] I/O loop starting for session {}", session_id);
    // Give the frontend a moment to set up its event listener before
    // we start forwarding data, so the initial prompt isn't lost.
    tokio::time::sleep(Duration::from_millis(200)).await;
    println!(
        "[aether ssh] I/O loop entering select for session {}",
        session_id
    );

    loop {
        tokio::select! {
            Some(data) = rx.recv() => {
                println!("[aether ssh] rx recv {} bytes for session {}", data.len(), session_id);
                if channel.data(&data[..]).await.is_err() {
                    println!("[aether ssh] channel.data() failed, breaking loop for session {}", session_id);
                    break;
                }
            }
            Some(msg) = channel.wait() => {
                match msg {
                    russh::ChannelMsg::Data { data } => {
                        let bytes: Vec<u8> = data.to_vec();
                        println!("[aether ssh] ChannelMsg::Data {} bytes for session {}", bytes.len(), session_id);
                        if let Err(e) = app.emit(&format!("ssh-data-{}", session_id), bytes.clone()) {
                            println!("[aether ssh] emit error for session {}: {}", session_id, e);
                        } else {
                            println!("[aether ssh] emitted ssh-data-{} with {} bytes", session_id, bytes.len());
                        }
                    }
                    russh::ChannelMsg::ExtendedData { data, .. } => {
                        let bytes: Vec<u8> = data.to_vec();
                        println!("[aether ssh] ChannelMsg::ExtendedData {} bytes for session {}", bytes.len(), session_id);
                        if let Err(e) = app.emit(&format!("ssh-data-{}", session_id), bytes.clone()) {
                            println!("[aether ssh] emit error for session {}: {}", session_id, e);
                        } else {
                            println!("[aether ssh] emitted ssh-data-{} with {} bytes", session_id, bytes.len());
                        }
                    }
                    russh::ChannelMsg::ExitStatus { .. } => {
                        println!("[aether ssh] ExitStatus for session {}, breaking loop", session_id);
                        break;
                    }
                    russh::ChannelMsg::Close => {
                        println!("[aether ssh] Close for session {}, breaking loop", session_id);
                        break;
                    }
                    russh::ChannelMsg::Eof => {
                        println!("[aether ssh] Eof for session {}, breaking loop", session_id);
                        break;
                    }
                    other => {
                        println!("[aether ssh] Other channel msg for session {}: {:?}", session_id, std::mem::discriminant(&other));
                    }
                }
            }
            else => {
                println!("[aether ssh] select! else branch for session {}, breaking loop", session_id);
                break;
            }
        }
    }

    println!("[aether ssh] I/O loop ended for session {}", session_id);
    // Notify frontend that the connection was closed (unexpected drop)
    if let Err(e) = app.emit(&format!("ssh-disconnected-{}", session_id), ()) {
        println!(
            "[aether ssh] disconnect emit error for session {}: {}",
            session_id, e
        );
    }

    // Graceful disconnect
    let _ = handle
        .disconnect(russh::Disconnect::ByApplication, "", "English")
        .await;
}

// [impl->feat~ssh-terminal~1]
// [impl->req~graceful-reconnect~1]
#[command]
pub async fn disconnect(session_id: String) -> Result<(), String> {
    crate::remote_edit::clear_watchers_for_session(&session_id);

    let mut sessions = SESSIONS
        .lock()
        .map_err(|e| format!("Mutex poisoned: {e}"))?;
    if let Some(state) = sessions.remove(&session_id) {
        state.task_handle.abort();
    }
    Ok(())
}

// [impl->feat~ssh-terminal~1]
// [impl->req~terminal-stream-not-invoke~1]
// [impl->req~sigwinch-forwarding~1]
#[command]
pub async fn send_data(session_id: String, data: Vec<u8>) -> Result<(), String> {
    let sessions = SESSIONS
        .lock()
        .map_err(|e| format!("Mutex poisoned: {e}"))?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session {session_id} not found"))?;

    if !session.connected {
        return Err(format!("Session {session_id} is not connected"));
    }

    session
        .tx
        .send(data)
        .map_err(|e| format!("Send failed: {e}"))?;
    Ok(())
}

// [impl->dsn~state-sync~1]
pub fn get_session(session_id: &str) -> Option<SessionInfo> {
    let sessions = SESSIONS.lock().ok()?;
    sessions.get(session_id).map(|s| SessionInfo {
        profile_id: s.profile_id.clone(),
        connected: s.connected,
    })
}

// [impl->feat~remote-file-browser~1]
pub fn get_sftp_session(
    session_id: &str,
) -> Option<Arc<tokio::sync::Mutex<russh_sftp::client::SftpSession>>> {
    let sessions = SESSIONS.lock().ok()?;
    sessions.get(session_id)?.sftp.clone()
}
