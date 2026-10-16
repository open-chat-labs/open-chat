use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::{ChatId, CommunityId, DeletedGroupInfoInternal, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct DeletedGroups {
    groups: HashMap<ChatId, DeletedGroupInfoInternal>,
    // The members still to be told of each deletion by the job which the user canister events
    // queue replaced, moved onto the queue in post_upgrade
    // TODO: remove once released
    #[serde(default)]
    pending_group_deleted_notifications: VecDeque<(ChatId, UserId)>,
}

impl DeletedGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DeletedGroupInfoInternal> {
        self.groups.get(chat_id)
    }

    // The groups which were imported into the community, each now one of its channels
    pub fn imported_into(&self, community_id: CommunityId) -> impl Iterator<Item = ChatId> + '_ {
        self.groups
            .values()
            .filter(move |g| {
                g.community_imported_into
                    .as_ref()
                    .is_some_and(|c| c.community_id == community_id)
            })
            .map(|g| g.id)
    }

    // Records the group as deleted, unless it already is
    pub fn insert(&mut self, deleted_group: DeletedGroupInfoInternal) -> bool {
        match self.groups.entry(deleted_group.id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(deleted_group);
                true
            }
        }
    }

    // One-off: the notifications still pending when the user canister events queue replaced the
    // job which sent them, each with the deleted group it is of
    // TODO: remove once released
    pub fn take_pending_notifications(&mut self) -> Vec<(UserId, DeletedGroupInfoInternal)> {
        std::mem::take(&mut self.pending_group_deleted_notifications)
            .into_iter()
            .filter_map(|(chat_id, user_id)| self.groups.get(&chat_id).map(|d| (user_id, d.clone())))
            .collect()
    }

    pub fn metrics(&self) -> Metrics {
        let mut public = 0;
        let mut private = 0;
        for group in self.groups.values() {
            if group.public {
                public += 1;
            } else {
                private += 1;
            }
        }

        Metrics { public, private }
    }
}

pub struct Metrics {
    pub public: u64,
    pub private: u64,
}
