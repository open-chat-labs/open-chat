use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct InitialAirdropQueue {
    queue: VecDeque<InitialAirdropEntry>,
    failed: Vec<InitialAirdropEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InitialAirdropEntry {
    pub user_id: UserId,
    pub neuron_controller: Principal,
    pub neuron_stake_e8s: u64,
}

impl InitialAirdropQueue {
    pub fn push(&mut self, entry: InitialAirdropEntry) {
        self.queue.push_back(entry);
    }

    pub fn take_next(&mut self) -> Option<InitialAirdropEntry> {
        self.queue.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn mark_failed(&mut self, entry: InitialAirdropEntry) {
        self.failed.push(entry);
    }

    pub fn failed(&self) -> &[InitialAirdropEntry] {
        &self.failed
    }
}
