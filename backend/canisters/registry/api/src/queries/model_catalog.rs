use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ModelCatalog;

// The current on-device model catalog. Empty `models` ⇒ the client falls back to its built-in default.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ModelCatalog),
}
