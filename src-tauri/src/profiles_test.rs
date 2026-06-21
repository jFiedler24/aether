#[cfg(test)]
mod tests {
    use crate::profiles::{
        decrypt_password_from_storage, encrypt_password_for_storage, sanitize_for_storage, Profile,
    };

    #[test]
    fn test_profile_serialization() {
        let profile = Profile {
            id: "p1".to_string(),
            name: "Prod".to_string(),
            host: "example.com".to_string(),
            port: 22,
            username: "deploy".to_string(),
            auth_type: "key".to_string(),
            private_key_path: Some("~/.ssh/id_ed25519".to_string()),
            password: None,
            color: "#22c55e".to_string(),
        };

        let toml = toml::to_string(&profile).expect("profile should serialize to TOML");
        let parsed: Profile = toml::from_str(&toml).expect("profile should deserialize");
        assert_eq!(parsed.host, "example.com");
        assert_eq!(parsed.auth_type, "key");
    }

    #[test]
    fn test_profile_required_fields() {
        let toml = r##"
id = "p1"
name = "Dev"
host = "127.0.0.1"
port = 22
username = "root"
authType = "password"
color = "#6366f1"
    "##;

        let parsed: Profile = toml::from_str(toml).expect("required profile fields should parse");
        assert_eq!(parsed.username, "root");
        assert_eq!(parsed.auth_type, "password");
    }

    #[test]
    fn test_profile_export_import() {
        let src = Profile {
            id: "p2".to_string(),
            name: "ImportExport".to_string(),
            host: "srv".to_string(),
            port: 2222,
            username: "user".to_string(),
            auth_type: "password".to_string(),
            private_key_path: None,
            password: Some("runtime-only".to_string()),
            color: "#ef4444".to_string(),
        };

        let exported = toml::to_string_pretty(&src).expect("export must succeed");
        let imported: Profile = toml::from_str(&exported).expect("import must succeed");
        assert_eq!(src.id, imported.id);
        assert_eq!(src.port, imported.port);
        assert_eq!(src.password, imported.password);
    }

    #[test]
    fn test_profile_password_sanitized_for_storage() {
        let src = Profile {
            id: "p3".to_string(),
            name: "Secure".to_string(),
            host: "secure-host".to_string(),
            port: 22,
            username: "user".to_string(),
            auth_type: "password".to_string(),
            private_key_path: None,
            password: Some("super-secret".to_string()),
            color: "#06b6d4".to_string(),
        };

        let persisted = sanitize_for_storage(&src).expect("sanitization should round-trip");
        assert_eq!(persisted.id, src.id);
        assert_eq!(persisted.auth_type, src.auth_type);
        assert_eq!(persisted.password, src.password);
    }

    #[test]
    fn test_password_encrypt_decrypt_roundtrip() {
        let cipher = encrypt_password_for_storage("super-secret")
            .expect("encryption should succeed");
        assert_ne!(cipher, "super-secret");

        let plain = decrypt_password_from_storage(&cipher).expect("decryption should succeed");
        assert_eq!(plain, "super-secret");
    }
}
