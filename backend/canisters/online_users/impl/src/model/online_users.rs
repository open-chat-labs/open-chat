use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct OnlineUsers {
    users: HashSet<Principal>,
}

impl OnlineUsers {
    pub fn push(&mut self, caller: Principal) {
        self.users.insert(caller);
    }

    pub fn take(&mut self) -> Vec<Principal> {
        std::mem::take(&mut self.users).into_iter().collect()
    }
}
