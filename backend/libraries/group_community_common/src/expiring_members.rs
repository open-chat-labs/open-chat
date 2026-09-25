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

    // Moves the entries of a user migrated to a MultiUser canister onto their new id. Any entries the
    // new id already has for the same gates are dropped, since the user's membership under their old
    // id replaces that under their new id.
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
        if migrated.is_empty() {
            return;
        }
        self.heap
            .retain(|m| !(m.user_id == new_user_id && migrated.iter().any(|e| e.channel_id == m.channel_id)));
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

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn migrate_user_id_moves_entries_replacing_any_for_the_same_gates() {
        let [old, new, other]: [UserId; 3] = [1, 2, 3].map(|i| Principal::from_slice(&[i]).into());
        let (channel1, channel2) = (Some(ChannelId::from(1u32)), Some(ChannelId::from(2u32)));
        let mut members = ExpiringMembers::default();
        for (expires, channel_id, user_id) in [
            (10, None, old),
            (20, channel1, old),
            (5, None, new),
            (15, channel2, new),
            (25, None, other),
        ] {
            members.push(ExpiringMember {
                expires,
                channel_id,
                user_id,
            });
        }

        members.migrate_user_id(old, new);

        let mut remaining = Vec::new();
        while let Some(m) = members.pop_if_expires_before(u64::MAX) {
            remaining.push((m.expires, m.channel_id, m.user_id));
        }
        assert_eq!(
            remaining,
            vec![(10, None, new), (15, channel2, new), (20, channel1, new), (25, None, other)]
        );
    }
}
