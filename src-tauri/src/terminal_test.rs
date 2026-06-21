#[cfg(test)]
mod tests {
    fn suggested_log_name(session_name: &str, timestamp: &str) -> String {
        format!("{}-{}.log", session_name.replace(' ', "-"), timestamp)
    }

    #[test]
    fn test_xterm_theme() {
        let name = suggested_log_name("Prod Session", "2026-06-20T12-00-00");
        assert!(name.ends_with(".log"));
        assert!(name.contains("Prod-Session"));
    }

    #[test]
    fn test_terminal_fit_addon() {
        let name = suggested_log_name("dev", "now");
        assert_eq!(name, "dev-now.log");
    }

    #[test]
    fn test_clipboard_fallback() {
        let name = suggested_log_name("clip board", "1");
        assert!(!name.contains(' '));
    }
}
