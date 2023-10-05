use registry_canister::NamedNeuron;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct NamedNeurons {
    last_updated: TimestampMillis,
    by_governance_canister: HashMap<CanisterId, Vec<NamedNeuron>>,
}

impl NamedNeurons {
    pub fn push(&mut self, governance_canister_id: CanisterId, neuron_id: String, name: String, now: TimestampMillis) -> bool {
        let neurons = self.by_governance_canister.entry(governance_canister_id).or_default();
        if neurons.iter().any(|n| n.name == name || n.neuron_id == neuron_id) {
            false
        } else {
            neurons.push(NamedNeuron {
                name,
                neuron_id,
                added: now,
            });
            self.last_updated = now;
            true
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn updated_since(&self, since: TimestampMillis) -> HashMap<CanisterId, Vec<NamedNeuron>> {
        self.by_governance_canister
            .iter()
            .map(|(k, v)| (*k, v.iter().filter(|n| n.added > since).cloned().collect::<Vec<_>>()))
            .filter(|(_, v)| !v.is_empty())
            .collect()
    }
}

impl AsRef<HashMap<CanisterId, Vec<NamedNeuron>>> for NamedNeurons {
    fn as_ref(&self) -> &HashMap<CanisterId, Vec<NamedNeuron>> {
        &self.by_governance_canister
    }
}
