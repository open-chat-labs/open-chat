use serde::{Deserialize, Serialize};
use types::{GroupChatSummaryInternal, TimestampMillis};
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
}
