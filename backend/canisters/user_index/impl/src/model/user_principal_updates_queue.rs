use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::{HashMap, VecDeque};
use types::{CanisterId, UpdateUserPrincipalArgs, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipalUpdatesQueue {
    counts_pending: HashMap<UserId, usize>,
    queue: VecDeque<(CanisterId, UpdateUserPrincipalArgs)>,
}

impl UserPrincipalUpdatesQueue {
    #[allow(dead_code)]
    pub fn count_pending(&self, user_id: &UserId) -> usize {
        self.counts_pending.get(user_id).copied().unwrap_or_default()
    }

    pub fn push(&mut self, args: UpdateUserPrincipalArgs, canisters_to_notify: Vec<CanisterId>) {
        self.counts_pending.insert(args.user_id, canisters_to_notify.len());

        for canister_id in canisters_to_notify {
            self.queue.push_back((canister_id, args.clone()));
        }
    }

    pub fn take(&mut self) -> Option<(CanisterId, UpdateUserPrincipalArgs)> {
        self.queue.pop_front()
    }

    pub fn mark_success(&mut self, user_id: UserId) {
        if let Occupied(mut e) = self.counts_pending.entry(user_id) {
            let value = e.get_mut();
            *value = value.saturating_sub(1);
            if *value == 0 {
                e.remove();
            }
        }
    }

    // TODO ensure we don't end up retrying forever
    pub fn mark_failure(&mut self, canister_id: CanisterId, args: UpdateUserPrincipalArgs) {
        self.queue.push_back((canister_id, args))
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }
}
