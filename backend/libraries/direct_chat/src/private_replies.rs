use ic_principal::Principal;
use stable_memory_map::{KeyPrefix, PrivateReplyKey, PrivateReplyKeyPrefix, with_map, with_map_mut};
use std::collections::HashSet;
use std::ops::RangeInclusive;
use types::{ChatId, MessageIndex, UserId};

// For each message the user has sent in a direct chat which privately replies to a message in a
// group, the index of the message and who it was sent to, keyed by the group being replied to.
//
// These are stored in the stable memory map for small entries so that when a group is imported
// into a community we can quickly find the replies which need to point at the new channel.

pub fn add(group_chat_id: ChatId, user_id: UserId, message_index: MessageIndex) {
    with_map_mut(|m| {
        m.insert(
            PrivateReplyKeyPrefix::new(group_chat_id).create_key(&(user_id, message_index)),
            Vec::new(),
        )
    });
}

// Removes and returns the replies to the given group
pub fn take(group_chat_id: ChatId) -> Vec<(UserId, MessageIndex)> {
    let keys: Vec<PrivateReplyKey> = with_map(|m| m.range(range(group_chat_id)).map(|(k, _)| k).collect());
    if keys.is_empty() {
        return Vec::new();
    }
    with_map_mut(|m| {
        keys.into_iter()
            .map(|key| {
                let entry = (key.user_id(), key.message_index());
                m.remove(key);
                entry
            })
            .collect()
    })
}

// The ids of the users the replies were sent to, whichever group they reply to
pub fn user_ids() -> HashSet<UserId> {
    with_map(|m| m.range(PrivateReplyKey::all()).map(|(key, _)| key.user_id()).collect())
}

// Replaces the id of the user each reply was sent to with `f` of it, whichever group it replies to,
// returning how many were replaced. A reply which ends up the same as another is only stored once.
pub fn update_user_ids(f: impl Fn(UserId) -> UserId) -> u32 {
    let to_update: Vec<(PrivateReplyKey, PrivateReplyKey)> = with_map(|m| {
        m.range(PrivateReplyKey::all())
            .filter_map(|(key, _)| {
                let user_id = key.user_id();
                let latest = f(user_id);
                (latest != user_id).then(|| {
                    let new_key = PrivateReplyKeyPrefix::new(key.group_chat_id()).create_key(&(latest, key.message_index()));
                    (key, new_key)
                })
            })
            .collect()
    });
    if to_update.is_empty() {
        return 0;
    }
    let count = to_update.len() as u32;
    let mut new_keys: Vec<_> = to_update.iter().map(|(_, new_key)| new_key.clone()).collect();
    // In key order, so that each node is written once
    new_keys.sort_unstable();
    new_keys.dedup();
    with_map_mut(|m| {
        for (key, _) in to_update {
            m.remove(key);
        }
        m.insert_many(new_keys.into_iter().map(|key| (key, Vec::new())));
    });
    count
}

// The range of keys of the replies to the given group. The iterators over this range borrow the
// stable memory map, so they must be consumed within `with_map`.
fn range(group_chat_id: ChatId) -> RangeInclusive<PrivateReplyKey> {
    let prefix = PrivateReplyKeyPrefix::new(group_chat_id);
    let min_user_id = UserId::from(Principal::from_slice(&[]));
    let max_user_id = UserId::from(Principal::from_slice(&[u8::MAX; 29]));
    prefix.create_key(&(min_user_id, MessageIndex::from(0)))..=prefix.create_key(&(max_user_id, MessageIndex::from(u32::MAX)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn replies_are_grouped_by_the_group_they_reply_to() {
        init_stable_memory_map();

        add(chat(1), user(1), 10.into());
        add(chat(1), user(2), 20.into());
        add(chat(2), user(1), 30.into());

        assert_eq!(take(chat(1)), vec![(user(1), 10.into()), (user(2), 20.into())]);
        // The replies to the first group have been removed, the others are untouched
        assert_eq!(take(chat(1)), Vec::new());
        assert_eq!(take(chat(2)), vec![(user(1), 30.into())]);
        assert_eq!(take(chat(3)), Vec::new());
    }

    #[test]
    fn the_same_reply_added_twice_is_only_stored_once() {
        init_stable_memory_map();

        add(chat(1), user(1), 10.into());
        add(chat(1), user(1), 10.into());

        assert_eq!(take(chat(1)), vec![(user(1), 10.into())]);
    }

    #[test]
    fn the_ids_replies_were_sent_to_are_replaced_in_every_group() {
        init_stable_memory_map();
        add(chat(1), user(1), 10.into());
        add(chat(1), user(2), 20.into());
        add(chat(2), user(1), 30.into());
        // Ends up the same as the reply to the first group sent to user 3
        add(chat(1), user(3), 10.into());

        assert_eq!(user_ids(), HashSet::from([user(1), user(2), user(3)]));
        let updated = update_user_ids(|user_id| if user_id == user(1) { user(3) } else { user_id });

        assert_eq!(updated, 2);
        assert_eq!(user_ids(), HashSet::from([user(2), user(3)]));
        assert_eq!(take(chat(1)), vec![(user(3), 10.into()), (user(2), 20.into())]);
        assert_eq!(take(chat(2)), vec![(user(3), 30.into())]);
        assert_eq!(update_user_ids(|_| user(4)), 0);
    }

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
