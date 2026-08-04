use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

// The storage bucket canister ids, for the vault-log audit view. Bucket ids are effectively
// public (they appear in every blob url), so this needs no guard.
#[ts_export(storage_index, vault_buckets)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(storage_index, vault_buckets)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    #[ts(as = "Vec::<ts_export::TSBytes>")]
    pub buckets: Vec<CanisterId>,
}
