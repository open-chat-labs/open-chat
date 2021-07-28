use crate::types::Version;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct CanisterWasm {
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
