// [utest->feat~connection-profiles~1]
// [utest->req~profile-fields~1]
// [utest->req~profile-import-export~1]
// [utest->req~no-plaintext-secrets~1]

#[cfg(test)]
mod tests {
    // [utest->feat~connection-profiles~1]
    #[test]
    fn test_profile_serialization() {
        // TODO: test TOML serialize/deserialize
    }

    // [utest->req~profile-fields~1]
    #[test]
    fn test_profile_required_fields() {
        // TODO: validate all required fields are present
    }

    // [utest->req~profile-import-export~1]
    #[test]
    fn test_profile_export_import() {
        // TODO: test round-trip export/import
    }
}
