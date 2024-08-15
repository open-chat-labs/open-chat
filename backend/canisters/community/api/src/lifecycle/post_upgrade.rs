use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{BuildVersion, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub deleted_users: HashSet<UserId>,
    pub wasm_version: BuildVersion,
}
