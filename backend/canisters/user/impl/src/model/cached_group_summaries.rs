use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{ChatId, GroupChatSummaryInternal, TimestampMillis};
use user_canister::updates::{GroupChatUpdatesSince, UpdatesSince};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct CachedGroupSummaries {
    pub timestamp: TimestampMillis,
    pub groups: Vec<GroupChatSummaryInternal>,
}

impl CachedGroupSummaries {
    pub fn updates_args(&self) -> UpdatesSince {
        UpdatesSince {
            timestamp: self.timestamp,
            group_chats: self
                .groups
                .iter()
                .map(|g| GroupChatUpdatesSince {
                    chat_id: g.chat_id,
                    updates_since: g.last_updated,
                })
                .collect(),
        }
    }

    pub fn filtered(&self, group_chat_ids: HashSet<ChatId>) -> CachedGroupSummaries {
        CachedGroupSummaries {
            timestamp: self.timestamp,
            groups: self
                .groups
                .iter()
                .filter(|g| group_chat_ids.contains(&g.chat_id))
                .cloned()
                .collect(),
        }
    }

    pub fn remove_group(&mut self, chat_id: &ChatId) {
        self.groups.retain(|g| g.chat_id != *chat_id);
    }
}
