use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Pool {
    target_size: u16,
    canister_ids: VecDeque<CanisterId>,
}

impl Pool {
    pub fn new(target_size: u16) -> Pool {
        Pool {
            target_size,
            canister_ids: VecDeque::default(),
        }
    }

    pub fn len(&self) -> usize {
        self.canister_ids.len()
    }

    pub fn is_empty(&self) -> bool {
        self.canister_ids.is_empty()
    }

    pub fn is_full(&self) -> bool {
        self.canister_ids.len() >= self.target_size as usize
    }

    pub fn push(&mut self, canister_id: CanisterId) {
        self.canister_ids.push_back(canister_id);
    }

    pub fn pop(&mut self) -> Option<CanisterId> {
        self.canister_ids.pop_front()
    }
}
