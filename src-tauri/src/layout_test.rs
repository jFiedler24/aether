#[cfg(test)]
mod tests {
    fn clamp_ratio(value: f32) -> f32 {
        value.clamp(0.1, 0.9)
    }

    fn toggle(collapsed: bool) -> bool {
        !collapsed
    }

    #[test]
    fn test_split_pane_layout() {
        assert!((clamp_ratio(0.4) - 0.4).abs() < f32::EPSILON);
        assert!((clamp_ratio(0.01) - 0.1).abs() < f32::EPSILON);
        assert!((clamp_ratio(0.95) - 0.9).abs() < f32::EPSILON);
    }

    #[test]
    fn test_file_browser_toggle() {
        assert!(toggle(false));
        assert!(!toggle(true));
    }
}
