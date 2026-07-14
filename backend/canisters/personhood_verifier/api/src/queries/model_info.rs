use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(personhood_verifier, model_info)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success(ModelInfo),
}

#[ts_export(personhood_verifier, model_info)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModelInfo {
    pub current_model_version: u16,
    pub enrolled_embeddings: u64,
}
