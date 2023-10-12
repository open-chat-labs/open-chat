use registry_canister::NervousSystem;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Milliseconds, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct NervousSystems {
    last_updated: TimestampMillis,
    nervous_systems: Vec<NervousSystemDetails>,
}

impl NervousSystems {
    pub fn add(&mut self, nervous_system: NervousSystemDetails) -> bool {
        if self.exists(nervous_system.root_canister_id) {
            false
        } else {
            self.nervous_systems.push(nervous_system);
            true
        }
    }

    pub fn get_all(&self) -> &[NervousSystemDetails] {
        &self.nervous_systems
    }

    pub fn exists(&self, root_canister_id: CanisterId) -> bool {
        self.nervous_systems.iter().any(|ns| ns.root_canister_id == root_canister_id)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NervousSystemDetails {
    pub root_canister_id: CanisterId,
    pub governance_canister_id: CanisterId,
    pub swap_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub index_canister_id: CanisterId,
    pub name: String,
    pub url: Option<String>,
    pub logo: String,
    pub description: Option<String>,
    pub min_dissolve_delay_to_vote: Milliseconds,
    pub min_neuron_stake: u64,
    pub proposal_rejection_fee: u64,
    pub is_nns: bool,
    pub added: TimestampMillis,
    pub last_updated: TimestampMillis,
}

impl From<NervousSystemDetails> for NervousSystem {
    fn from(value: NervousSystemDetails) -> Self {
        NervousSystem {
            is_nns: value.is_nns,
            root: value.root_canister_id,
            governance: value.governance_canister_id,
        }
    }
}

#[derive(Serialize)]
pub struct NervousSystemMetrics {
    root_canister_id: CanisterId,
    governance_canister_id: CanisterId,
    swap_canister_id: CanisterId,
    ledger_canister_id: CanisterId,
    index_canister_id: CanisterId,
    name: String,
    url: Option<String>,
    logo_length: usize,
    description: Option<String>,
    min_dissolve_delay_to_vote: Milliseconds,
    min_neuron_stake: u64,
    proposal_rejection_fee: u64,
    is_nns: bool,
    added: TimestampMillis,
    last_updated: TimestampMillis,
}

impl From<&NervousSystemDetails> for NervousSystemMetrics {
    fn from(value: &NervousSystemDetails) -> Self {
        NervousSystemMetrics {
            root_canister_id: value.root_canister_id,
            governance_canister_id: value.governance_canister_id,
            swap_canister_id: value.swap_canister_id,
            ledger_canister_id: value.ledger_canister_id,
            index_canister_id: value.index_canister_id,
            name: value.name.clone(),
            url: value.url.clone(),
            logo_length: value.logo.len(),
            description: value.description.clone(),
            min_dissolve_delay_to_vote: value.min_dissolve_delay_to_vote,
            min_neuron_stake: value.min_neuron_stake,
            proposal_rejection_fee: value.proposal_rejection_fee,
            is_nns: value.is_nns,
            added: value.added,
            last_updated: value.last_updated,
        }
    }
}
