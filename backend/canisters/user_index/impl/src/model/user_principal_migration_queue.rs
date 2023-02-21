use crate::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::{HashMap, VecDeque};
use types::{CanisterId, ChatId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipalMigrationQueue {
    counts_pending: HashMap<UserId, usize>,
    queue: VecDeque<(UserId, CanisterToNotifyOfUserPrincipalMigration)>,
}

impl UserPrincipalMigrationQueue {
    pub fn count_pending(&self, user_id: &UserId) -> usize {
        self.counts_pending.get(user_id).copied().unwrap_or_default()
    }

    pub fn push(
        &mut self,
        user_id: UserId,
        old_principal: Principal,
        new_principal: Principal,
        groups: Vec<ChatId>,
        storage_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
    ) {
        self.counts_pending.insert(user_id, groups.len() + 2);

        self.queue.push_back((
            user_id,
            CanisterToNotifyOfUserPrincipalMigration::StorageIndex(
                storage_index_canister_id,
                storage_index_canister::update_user_id::Args {
                    old_user_id: old_principal,
                    new_user_id: new_principal,
                },
            ),
        ));

        self.queue.push_back((
            user_id,
            CanisterToNotifyOfUserPrincipalMigration::Notifications(
                notifications_index_canister_id,
                notifications_index_canister::c2c_update_user_principal::Args {
                    old_principal,
                    new_principal,
                },
            ),
        ));

        for chat_id in groups {
            self.queue.push_back((
                user_id,
                CanisterToNotifyOfUserPrincipalMigration::Group(
                    chat_id,
                    group_canister::c2c_update_user_principal::Args { user_id, new_principal },
                ),
            ));
        }
    }

    pub fn take(&mut self) -> Option<(UserId, CanisterToNotifyOfUserPrincipalMigration)> {
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
    pub fn mark_failure(&mut self, user_id: UserId, canister: CanisterToNotifyOfUserPrincipalMigration) {
        self.queue.push_back((user_id, canister))
    }
}

#[derive(Serialize, Deserialize)]
pub enum CanisterToNotifyOfUserPrincipalMigration {
    StorageIndex(CanisterId, storage_index_canister::update_user_id::Args),
    Notifications(CanisterId, notifications_index_canister::c2c_update_user_principal::Args),
    Group(ChatId, group_canister::c2c_update_user_principal::Args),
}
