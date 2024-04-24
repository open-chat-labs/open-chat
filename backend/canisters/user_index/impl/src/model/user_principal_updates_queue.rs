use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::{HashMap, VecDeque};
use types::{CanisterId, UpdateUserPrincipalArgs, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipalUpdatesQueue {
    progress: HashMap<UserId, (u32, u32)>,
    queue: VecDeque<(CanisterId, UpdateUserPrincipalArgs)>,
}

impl UserPrincipalUpdatesQueue {
    pub fn progress(&self, user_id: &UserId) -> Option<(u32, u32)> {
        self.progress.get(user_id).copied()
    }

    pub fn push(&mut self, args: UpdateUserPrincipalArgs, canisters_to_notify: Vec<CanisterId>) {
        self.progress.insert(args.user_id, (0, canisters_to_notify.len() as u32));

        for canister_id in canisters_to_notify {
            self.queue.push_back((canister_id, args.clone()));
        }
    }

    pub fn take(&mut self) -> Option<(CanisterId, UpdateUserPrincipalArgs)> {
        self.queue.pop_front()
    }

    pub fn mark_success(&mut self, user_id: UserId) {
        if let Occupied(mut e) = self.progress.entry(user_id) {
            let (complete, total) = e.get_mut();
            *complete = complete.saturating_add(1);
            if *complete == *total {
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
