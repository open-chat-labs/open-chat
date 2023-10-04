use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, SnsNeuronId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub stake: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SnsNeuronId),
    NeuronAlreadyExists(SnsNeuronId),
    StakeTooLow,
    TransferError(String),
    GovernanceCanisterNotSupported,
    Unauthorized,
    InternalError(String),
}
