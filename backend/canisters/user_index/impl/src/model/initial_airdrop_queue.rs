use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct InitialAirdropQueue {
    queue: VecDeque<InitialAirdropEntry>,
    failed: Vec<InitialAirdropEntry>,
    #[serde(default = "true_")]
    can_start_next: bool,
}

fn true_() -> bool {
    true
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
        if let Some(next) = self.queue.pop_front() {
            self.can_start_next = false;
            Some(next)
        } else {
            None
        }
    }

    pub fn can_start_next(&self) -> bool {
        self.can_start_next
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn mark_split_complete(&mut self) {
        self.can_start_next = true;
    }

    pub fn mark_failed(&mut self, entry: InitialAirdropEntry) {
        self.failed.push(entry);
    }

    pub fn failed(&self) -> &[InitialAirdropEntry] {
        &self.failed
    }

    pub fn retry_failed(&mut self) {
        while let Some(next) = self.failed.pop() {
            self.queue.push_back(next);
        }
    }
}
