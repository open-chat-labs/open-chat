use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use types::{ChannelId, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringMembers {
    queue: BinaryHeap<ExpiringMember>,
}

#[derive(Serialize, Deserialize, Eq, PartialEq, Ord, PartialOrd)]
pub struct ExpiringMember {
    pub expires: TimestampMillis,
    pub channel_id: Option<ChannelId>,
    pub user_id: UserId,
}

impl ExpiringMembers {
    pub fn push(&mut self, member: ExpiringMember) {
        self.queue.push(member);
    }

    pub fn pop_if_expires_before(&mut self, expires_before: TimestampMillis) -> Option<ExpiringMember> {
        if let Some(member) = self.queue.peek() {
            if member.expires < expires_before {
                return self.queue.pop();
            }
        }

        None
    }

    pub fn remove_matching(&mut self, channel_id: Option<ChannelId>) {
        self.queue.retain(|m| m.channel_id != channel_id);
    }

    pub fn remove(&mut self, user_id: UserId, channel_id: Option<ChannelId>) {
        self.queue
            .retain(|m| !(m.user_id == user_id && (channel_id.is_none() || channel_id == m.channel_id)));
    }
}
