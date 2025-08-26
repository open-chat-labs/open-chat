use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(proposals_bot, top_up_neuron)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub amount: u128,
}

#[ts_export(proposals_bot, top_up_neuron)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TransferError(String),
    GovernanceCanisterNotSupported,
    Unauthorized,
    InternalError(String),
}
