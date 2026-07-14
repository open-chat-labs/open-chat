use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::SuccessOnly;

// Right to erasure: lets a user revoke their own unique-personhood
// verification. Removes the proof everywhere and deletes their face
// embedding (and attempt history) from the personhood verifier. Idempotent -
// removing when not verified is a no-op Success. The user can re-verify at
// any time; their face is then treated as brand new.
#[ts_export(user_index, remove_unique_person_proof)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

pub type Response = SuccessOnly;
