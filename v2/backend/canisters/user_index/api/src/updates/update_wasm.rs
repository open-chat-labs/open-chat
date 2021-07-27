use candid::CandidType;
use serde::Deserialize;
use shared::types::Version;

#[derive(CandidType, Deserialize)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub user_wasm_module: Vec<u8>,
    pub version: Version,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    NotAuthorized,
    VersionNotHigher,
}
