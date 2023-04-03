use crate::{CanisterId, Milliseconds};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupGate {
    DiamondMember,
    SnsNeuron(SnsNeuronGate),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SnsNeuronGate {
    pub governance_canister_id: CanisterId,
    pub min_stake_e8s: Option<u64>,
    pub min_dissolve_delay: Option<Milliseconds>,
}
