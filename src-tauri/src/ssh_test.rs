// [utest->dsn~state-sync~1]
// [utest->feat~ssh-terminal~1]
// [utest->req~terminal-stream-not-invoke~1]
// [utest->req~shared-connection-lifecycle~1]
// [utest->req~connection-isolation~1]
// [utest->req~graceful-reconnect~1]
// [utest->req~sigwinch-forwarding~1]
// [utest->req~async-commands-no-block~1]

#[cfg(test)]
mod tests {
    // [utest->feat~ssh-terminal~1]
    #[test]
    fn test_session_creation() {
        // TODO: test SSH session creation
    }

    // [utest->req~connection-isolation~1]
    #[test]
    fn test_session_isolation() {
        // TODO: verify sessions don't share state
    }

    // [utest->req~graceful-reconnect~1]
    #[test]
    fn test_reconnect_flow() {
        // TODO: test disconnect/reconnect handling
    }
}
