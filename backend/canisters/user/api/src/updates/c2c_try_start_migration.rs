use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub multi_user_canister_id: CanisterId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // The size of the user serialized with msgpack, which the MultiUser canister then pulls
    pub user_bytes: u64,
    // The version of the User canister the user was serialized by, which the MultiUser canister
    // must match to deserialize them
    pub wasm_version: BuildVersion,
}
