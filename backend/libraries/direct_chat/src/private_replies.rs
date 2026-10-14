use ic_principal::Principal;
use stable_memory_map::{KeyPrefix, PrivateReplyKey, PrivateReplyKeyPrefix, with_map, with_map_mut};
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
