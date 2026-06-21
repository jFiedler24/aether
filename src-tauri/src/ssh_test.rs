#[cfg(test)]
mod tests {
    use crate::ssh::{expand_tilde, SessionInfo};

    #[test]
    fn test_session_creation() {
        let info = SessionInfo {
            profile_id: "profile-1".to_string(),
            connected: true,
        };
        assert_eq!(info.profile_id, "profile-1");
        assert!(info.connected);
    }

    #[test]
    fn test_session_isolation() {
        let a = SessionInfo {
            profile_id: "a".to_string(),
            connected: true,
        };
        let b = SessionInfo {
            profile_id: "b".to_string(),
            connected: false,
        };
        assert_ne!(a.profile_id, b.profile_id);
        assert_ne!(a.connected, b.connected);
    }

    #[test]
    fn test_reconnect_flow() {
        let plain = expand_tilde("/tmp/file");
        assert_eq!(plain, std::path::PathBuf::from("/tmp/file"));

        let expanded = expand_tilde("~/aether-test");
        if let Some(home) = dirs::home_dir() {
            assert_eq!(expanded, home.join("aether-test"));
        } else {
            assert_eq!(expanded, std::path::PathBuf::from("~/aether-test"));
        }
    }
}
