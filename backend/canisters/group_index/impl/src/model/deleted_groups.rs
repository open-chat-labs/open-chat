use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::{ChatId, DeletedGroupInfoInternal, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct DeletedGroups {
    groups: HashMap<ChatId, DeletedGroupInfoInternal>,
    pending_group_deleted_notifications: VecDeque<(ChatId, UserId)>,
}

impl DeletedGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DeletedGroupInfoInternal> {
        self.groups.get(chat_id)
    }

    pub fn insert(&mut self, deleted_group: DeletedGroupInfoInternal, members: Vec<UserId>) -> bool {
        let chat_id = deleted_group.id;

        match self.groups.entry(chat_id) {
            Occupied(_) => false,
            Vacant(e) => {
                let deleted_by = deleted_group.deleted_by;
                for user_id in members.into_iter().filter(|u| *u != deleted_by) {
                    self.pending_group_deleted_notifications.push_back((chat_id, user_id));
                }
                e.insert(deleted_group);
                true
            }
        }
    }

    pub fn dequeue_group_deleted_notification(&mut self) -> Option<(UserId, DeletedGroupInfoInternal)> {
        self.pending_group_deleted_notifications
            .pop_front()
            .and_then(|(chat_id, user_id)| self.groups.get(&chat_id).map(|d| (user_id, d.clone())))
    }

    pub fn notifications_pending(&self) -> usize {
        self.pending_group_deleted_notifications.len()
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

        Metrics {
            public,
            private,
            notifications_pending: self.pending_group_deleted_notifications.len() as u64,
        }
    }
}

pub struct Metrics {
    pub public: u64,
    pub private: u64,
    pub notifications_pending: u64,
}
