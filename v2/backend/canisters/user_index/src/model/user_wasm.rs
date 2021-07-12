#[derive(Clone)]
pub struct UserWasm {
    pub module: Vec<u8>,
    pub version: semver::Version,
}

impl Default for UserWasm {
    fn default() -> Self {
        UserWasm {
            module: Vec::default(),
            version: semver::Version::new(0, 0, 0),
        }
    }
}
