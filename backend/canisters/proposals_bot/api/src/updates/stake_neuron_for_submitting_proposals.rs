use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, SnsNeuronId};

#[ts_export(proposals_bot, stake_neuron_for_submitting_proposals)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub stake: u128,
}

#[ts_export(proposals_bot, stake_neuron_for_submitting_proposals)]
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
