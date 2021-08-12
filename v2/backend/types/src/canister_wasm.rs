use crate::Version;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct CanisterWasm {
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
    pub version: Version,
}

impl Default for CanisterWasm {
    fn default() -> Self {
        CanisterWasm {
            module: Vec::default(),
            version: Version::new(0, 0, 0),
        }
    }
}
