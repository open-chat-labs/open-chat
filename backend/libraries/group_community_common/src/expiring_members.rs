use serde::{Deserialize, Serialize};
use types::{ChannelId, TimestampMillis, UserId};
use utils::min_heap::MinBinaryHeap;

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringMembers {
    heap: MinBinaryHeap<ExpiringMember>,
}

#[derive(Serialize, Deserialize, Eq, PartialEq, Ord, PartialOrd)]
pub struct ExpiringMember {
    pub expires: TimestampMillis,
    pub channel_id: Option<ChannelId>,
    pub user_id: UserId,
}

impl ExpiringMembers {
    pub fn push(&mut self, member: ExpiringMember) {
        self.heap.push(member);
    }

    pub fn pop_if_expires_before(&mut self, expires_before: TimestampMillis) -> Option<ExpiringMember> {
        if let Some(member) = self.heap.peek()
            && member.expires < expires_before
        {
            return self.heap.pop();
        }

        None
    }

    pub fn remove_gate(&mut self, channel_id: Option<ChannelId>) {
        self.heap.retain(|m| m.channel_id != channel_id);
    }

    pub fn remove_member(&mut self, user_id: UserId, channel_id: Option<ChannelId>) {
        self.heap
            .retain(|m| !(m.user_id == user_id && (channel_id.is_none() || channel_id == m.channel_id)));
    }

    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        // The user id is part of each entry's ordering, so the user's entries are taken out and pushed
        // back in under their new id
        let mut migrated = Vec::new();
        self.heap.retain(|m| {
            if m.user_id == old_user_id {
                migrated.push(ExpiringMember {
                    expires: m.expires,
                    channel_id: m.channel_id,
                    user_id: new_user_id,
                });
                false
            } else {
                true
            }
        });
        for member in migrated {
            self.heap.push(member);
        }
    }

    pub fn change_gate_expiry(&mut self, channel_id: Option<ChannelId>, expiry_difference: i64) {
        if expiry_difference == 0 {
            return;
        }

        let mut new_heap = MinBinaryHeap::new();

        for mut e in self.heap.drain() {
            if e.channel_id == channel_id {
                e.expires = e.expires.saturating_add_signed(expiry_difference)
            }

            new_heap.push(e);
        }

        self.heap = new_heap;
    }

    pub fn next_expiry(&self) -> Option<TimestampMillis> {
        self.heap.peek().map(|m| m.expires)
    }
}
