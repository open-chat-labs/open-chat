use registry_canister::NervousSystemDetails;
use serde::{Deserialize, Serialize};
use sns_governance_canister::types::NervousSystemParameters;
use sns_governance_canister::types::governance::SnsMetadata;
use types::{CanisterId, Milliseconds, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct NervousSystems {
    last_updated: TimestampMillis,
    nervous_systems: Vec<NervousSystemDetails>,
}

impl NervousSystems {
    pub fn add(&mut self, nervous_system: NervousSystemDetails, now: TimestampMillis) -> bool {
        if self.exists(nervous_system.root_canister_id) {
            false
        } else {
            self.nervous_systems.push(nervous_system);
            self.last_updated = now;
            true
        }
    }

    pub fn get_all(&self) -> &[NervousSystemDetails] {
        &self.nervous_systems
    }

    pub fn exists(&self, root_canister_id: CanisterId) -> bool {
        self.nervous_systems.iter().any(|ns| ns.root_canister_id == root_canister_id)
    }

    pub fn update(
        &mut self,
        root_canister_id: CanisterId,
        metadata: SnsMetadata,
        parameters: NervousSystemParameters,
        now: TimestampMillis,
    ) -> bool {
        let mut any_updates = false;
        if let Some(ns) = self
            .nervous_systems
            .iter_mut()
            .find(|ns| ns.root_canister_id == root_canister_id)
        {
            let name = metadata.name.unwrap_or_default();
            if ns.name != name {
                ns.name = name;
                any_updates = true;
            }
            if ns.url != metadata.url {
                ns.url = metadata.url;
                any_updates = true;
            }
            let logo = metadata.logo.unwrap_or_default();
            if ns.logo != logo {
                ns.logo = logo;
                any_updates = true;
            }
            if ns.description != metadata.description {
                ns.description = metadata.description;
                any_updates = true;
            }
            let transaction_fee = parameters.transaction_fee_e8s.unwrap_or_default();
            if ns.transaction_fee != transaction_fee {
                ns.transaction_fee = transaction_fee;
                any_updates = true;
            }
            let min_neuron_stake = parameters.neuron_minimum_stake_e8s.unwrap_or_default();
            if ns.min_neuron_stake != min_neuron_stake {
                ns.min_neuron_stake = min_neuron_stake;
                any_updates = true;
            }
            let min_dissolve_delay_to_vote =
                parameters.neuron_minimum_dissolve_delay_to_vote_seconds.unwrap_or_default() * 1000;
            if ns.min_dissolve_delay_to_vote != min_dissolve_delay_to_vote {
                ns.min_dissolve_delay_to_vote = min_dissolve_delay_to_vote;
                any_updates = true;
            }
            let proposal_rejection_fee = parameters.reject_cost_e8s.unwrap_or_default();
            if ns.proposal_rejection_fee != proposal_rejection_fee {
                ns.proposal_rejection_fee = proposal_rejection_fee;
                any_updates = true;
            }
            if any_updates {
                ns.last_updated = now;
                self.last_updated = now;
            }
        }

        any_updates
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn set_submitting_proposals_enabled(
        &mut self,
        governance_canister_id: CanisterId,
        enabled: bool,
        now: TimestampMillis,
    ) {
        if let Some(ns) = self
            .nervous_systems
            .iter_mut()
            .find(|ns| ns.governance_canister_id == governance_canister_id)
        {
            ns.submitting_proposals_enabled = enabled;
            ns.last_updated = now;
            self.last_updated = now;
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
    transaction_fee: u64,
    min_neuron_stake: u64,
    min_dissolve_delay_to_vote: Milliseconds,
    proposal_rejection_fee: u64,
    is_nns: bool,
    submitting_proposals_enabled: bool,
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
            transaction_fee: value.transaction_fee,
            min_neuron_stake: value.min_neuron_stake,
            min_dissolve_delay_to_vote: value.min_dissolve_delay_to_vote,
            proposal_rejection_fee: value.proposal_rejection_fee,
            is_nns: value.is_nns,
            submitting_proposals_enabled: value.submitting_proposals_enabled,
            added: value.added,
            last_updated: value.last_updated,
        }
    }
}
