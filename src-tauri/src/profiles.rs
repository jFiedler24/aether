use aes_gcm::aead::Aead;
use aes_gcm::KeyInit;
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

// [impl->req~profile-fields~1]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    // [impl->req~profile-fields~1]
    // Preserved case-sensitive; no normalization applied.
    pub username: String,
    pub auth_type: String,
    pub private_key_path: Option<String>,
    // [impl->req~profile-fields~1]
    // Passwords are accepted at runtime but not persisted to disk.
    pub password: Option<String>,
    pub color: String,
}

// TOML requires a named key for arrays of tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfilesFile {
    profiles: Vec<Profile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProfile {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    private_key_path: Option<String>,
    encrypted_password: Option<String>,
    color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProfilesFile {
    profiles: Vec<StoredProfile>,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aether")
}

fn profiles_path() -> PathBuf {
    config_dir().join("profiles.toml")
}

pub(crate) fn encrypt_password_for_storage(password: &str) -> Result<String, String> {
    let key = crate::settings::get_or_create_encryption_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Invalid encryption key length: {e}"))?;

    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), password.as_bytes())
        .map_err(|e| format!("Password encryption failed: {e}"))?;

    let mut payload = nonce_bytes.to_vec();
    payload.extend_from_slice(&ciphertext);
    Ok(base64::engine::general_purpose::STANDARD.encode(payload))
}

pub(crate) fn decrypt_password_from_storage(encrypted: &str) -> Result<String, String> {
    let key = crate::settings::get_or_create_encryption_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Invalid encryption key length: {e}"))?;

    let payload = base64::engine::general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| format!("Invalid encrypted password encoding: {e}"))?;
    if payload.len() < 13 {
        return Err("Encrypted password payload is too short".to_string());
    }

    let (nonce_bytes, ciphertext) = payload.split_at(12);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|e| format!("Password decryption failed: {e}"))?;

    String::from_utf8(plaintext).map_err(|e| format!("Decrypted password is not UTF-8: {e}"))
}

fn stored_to_profile(stored: StoredProfile) -> Result<Profile, String> {
    let password = match stored.encrypted_password {
        Some(encrypted) => Some(decrypt_password_from_storage(&encrypted)?),
        None => None,
    };

    Ok(Profile {
        id: stored.id,
        name: stored.name,
        host: stored.host,
        port: stored.port,
        username: stored.username,
        auth_type: stored.auth_type,
        private_key_path: stored.private_key_path,
        password,
        color: stored.color,
    })
}

fn profile_to_stored(profile: &Profile) -> Result<StoredProfile, String> {
    let encrypted_password = match profile.password.as_deref() {
        Some(password) if !password.is_empty() => Some(encrypt_password_for_storage(password)?),
        _ => None,
    };

    Ok(StoredProfile {
        id: profile.id.clone(),
        name: profile.name.clone(),
        host: profile.host.clone(),
        port: profile.port,
        username: profile.username.clone(),
        auth_type: profile.auth_type.clone(),
        private_key_path: profile.private_key_path.clone(),
        encrypted_password,
        color: profile.color.clone(),
    })
}

fn read_profiles_file() -> Result<ProfilesFile, String> {
    let path = profiles_path();
    if !path.exists() {
        return Ok(ProfilesFile { profiles: vec![] });
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    // Try encrypted wrapper format first, then fall back to older plaintext formats.
    if let Ok(file) = toml::from_str::<StoredProfilesFile>(&contents) {
        let profiles = file
            .profiles
            .into_iter()
            .map(stored_to_profile)
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(ProfilesFile { profiles });
    }
    if let Ok(file) = toml::from_str::<ProfilesFile>(&contents) {
        return Ok(file);
    }
    if let Ok(profiles) = toml::from_str::<Vec<Profile>>(&contents) {
        return Ok(ProfilesFile { profiles });
    }
    Err("Failed to parse profiles.toml".to_string())
}

fn write_profiles_file(file: &ProfilesFile) -> Result<(), String> {
    let path = profiles_path();
    std::fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let stored_profiles = file
        .profiles
        .iter()
        .map(profile_to_stored)
        .collect::<Result<Vec<_>, _>>()?;
    let stored = StoredProfilesFile {
        profiles: stored_profiles,
    };
    let contents = toml::to_string_pretty(&stored).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
pub(crate) fn sanitize_for_storage(profile: &Profile) -> Result<Profile, String> {
    let stored = profile_to_stored(profile)?;
    stored_to_profile(stored)
}

// [impl->arch~backend-rust-async~1]
// [impl->req~no-plaintext-secrets~1]
#[command]
pub async fn list_profiles() -> Result<Vec<Profile>, String> {
    let path = profiles_path();
    if !path.exists() {
        // Return demo profiles for development
        // [impl->req~profile-fields~1]
        return Ok(vec![
            Profile {
                id: "demo-1".to_string(),
                name: "Raspberry Pi".to_string(),
                host: "192.168.178.142".to_string(),
                port: 22,
                username: "pi".to_string(),
                auth_type: "password".to_string(),
                private_key_path: None,
                password: None,
                color: "#ef4444".to_string(),
            },
            Profile {
                id: "demo-2".to_string(),
                name: "Production".to_string(),
                host: "prod.example.com".to_string(),
                port: 22,
                username: "deploy".to_string(),
                auth_type: "key".to_string(),
                private_key_path: Some("~/.ssh/id_rsa".to_string()),
                password: None,
                color: "#22c55e".to_string(),
            },
        ]);
    }

    let file = read_profiles_file()?;
    Ok(file.profiles)
}

// [impl->feat~connection-profiles~1]
// [impl->req~profile-fields~1]
// [impl->req~profile-import-export~1]
// [impl->req~profile-encryption~1]
#[command]
pub async fn save_profile(profile: Profile) -> Result<(), String> {
    let mut file = read_profiles_file()?;
    if let Some(idx) = file.profiles.iter().position(|p| p.id == profile.id) {
        file.profiles[idx] = profile;
    } else {
        file.profiles.push(profile);
    }
    write_profiles_file(&file)?;

    // [impl->req~ssh-config-auto-update~1]
    Ok(())
}

#[command]
pub async fn delete_profile(id: String) -> Result<(), String> {
    let mut file = read_profiles_file()?;
    file.profiles.retain(|p| p.id != id);
    write_profiles_file(&file)?;

    // [impl->req~ssh-config-auto-update~1]
    Ok(())
}
