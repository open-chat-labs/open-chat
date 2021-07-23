#[derive(Clone)]
pub struct CanisterWasm {
    pub module: Vec<u8>,
    pub version: semver::Version,
}

impl Default for CanisterWasm {
    fn default() -> Self {
        CanisterWasm {
            module: Vec::default(),
            version: semver::Version::new(0, 0, 0),
        }
    }
}
