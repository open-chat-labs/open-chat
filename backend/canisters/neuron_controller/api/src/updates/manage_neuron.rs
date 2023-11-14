use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = nns_governance_canister::manage_neuron::Args;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
