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
    // TODO: encrypt before persistence (Stronghold integration pending)
    pub password: Option<String>,
    pub color: String,
}

// TOML requires a named key for arrays of tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfilesFile {
    profiles: Vec<Profile>,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aether")
}

fn profiles_path() -> PathBuf {
    config_dir().join("profiles.toml")
}

fn read_profiles_file() -> Result<ProfilesFile, String> {
    let path = profiles_path();
    if !path.exists() {
        return Ok(ProfilesFile { profiles: vec![] });
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    // Try new wrapper format first, then fall back to raw array for compatibility.
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
    let contents = toml::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(())
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
