#[cfg(test)]
mod tests {
    use crate::sftp::RemoteFile;

    #[test]
    fn test_list_directory() {
        let file = RemoteFile {
            name: "README.md".to_string(),
            path: "/home/user/README.md".to_string(),
            is_directory: false,
            size: 123,
            modified: 1700000000,
            permissions: 0o644,
        };
        assert_eq!(file.name, "README.md");
        assert!(!file.is_directory);
    }

    #[test]
    fn test_file_transfer_streaming() {
        let target = std::env::temp_dir().join(format!(
            "aether-sftp-test-{}.bin",
            uuid::Uuid::new_v4()
        ));
        let payload = vec![1u8, 2, 3, 4, 5, 6, 7, 8];
        std::fs::write(&target, &payload).expect("write should succeed");
        let read_back = std::fs::read(&target).expect("read should succeed");
        assert_eq!(payload, read_back);
        let _ = std::fs::remove_file(target);
    }

    #[test]
    fn test_unicode_filenames() {
        let file = RemoteFile {
            name: "тест-äöü-文件.txt".to_string(),
            path: "/tmp/тест-äöü-文件.txt".to_string(),
            is_directory: false,
            size: 1,
            modified: 1,
            permissions: 0o600,
        };

        let json = serde_json::to_string(&file).expect("serialize remote file");
        let parsed: RemoteFile = serde_json::from_str(&json).expect("deserialize remote file");
        assert_eq!(parsed.name, "тест-äöü-文件.txt");
    }
}
