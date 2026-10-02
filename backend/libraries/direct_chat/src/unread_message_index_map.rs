use serde::{Deserialize, Serialize};
use stable_memory_map::{
    ChatEventKeyPrefix, DirectChatUnreadMessageIndexKey, DirectChatUnreadMessageIndexKeyPrefix, KeyPrefix, with_map,
    with_map_mut,
};
use std::ops::RangeInclusive;
use types::MessageIndex;

/// This is used to tell the other user which of their messages we have read.
/// Their message indexes will not necessarily match with ours, so when we mark a message as read
/// using our own message index, we then need to convert that into their message index and tell them
/// that it has been read. Because this map is only used to handle marking their messages as read,
/// it only stores data for messages sent by them, and we can remove entries once they have been
/// marked as read.
///
/// The entries are stored in the stable memory map for small entries under a prefix derived from
/// the chat's events prefix (which contains the chat's `key_id`), so that must be passed in to
/// identify them.
///
/// It has braces, rather than being a unit struct, since it is serialized as an empty map.
#[derive(Serialize, Deserialize, Default)]
pub(crate) struct UnreadMessageIndexMap {}

impl UnreadMessageIndexMap {
    pub(crate) fn add(&mut self, events_prefix: &ChatEventKeyPrefix, ours: MessageIndex, theirs: MessageIndex) {
        let key = prefix(events_prefix).create_key(&ours);
        with_map_mut(|m| m.insert(key, u32::from(theirs).to_be_bytes().to_vec()));
    }

    pub(crate) fn get_max_read_up_to_of_theirs(
        &self,
        events_prefix: &ChatEventKeyPrefix,
        ours_read_up_to: &MessageIndex,
    ) -> Option<MessageIndex> {
        let prefix = prefix(events_prefix);
        with_map(|m| {
            m.range(prefix.create_key(&MessageIndex::from(0))..=prefix.create_key(ours_read_up_to))
                .map(|(_, v)| value_from_bytes(&v))
                .max()
        })
    }

    pub(crate) fn remove_up_to(&mut self, events_prefix: &ChatEventKeyPrefix, theirs: MessageIndex) {
        with_map_mut(|m| {
            // Their message indexes aren't necessarily in the same order as ours, so every entry
            // must be checked
            let keys: Vec<_> = m
                .range(all_keys(events_prefix))
                .filter(|(_, v)| value_from_bytes(v) <= theirs)
                .map(|(k, _)| k)
                .collect();
            for key in keys {
                m.remove(key);
            }
        });
    }
}

// Panics if the events prefix isn't for the main events list of a `key_id` based direct chat. Every
// direct chat has a `key_id`, so this always holds.
pub(crate) fn prefix(events_prefix: &ChatEventKeyPrefix) -> DirectChatUnreadMessageIndexKeyPrefix {
    DirectChatUnreadMessageIndexKeyPrefix::new_from_events_prefix(events_prefix)
}

fn all_keys(events_prefix: &ChatEventKeyPrefix) -> RangeInclusive<DirectChatUnreadMessageIndexKey> {
    let prefix = prefix(events_prefix);
    prefix.create_key(&MessageIndex::from(0))..=prefix.create_key(&MessageIndex::from(u32::MAX))
}

// Their message index    4 bytes
fn value_from_bytes(bytes: &[u8]) -> MessageIndex {
    u32::from_be_bytes(bytes[..4].try_into().unwrap()).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn map_is_serialized_as_an_empty_map() {
        let bytes = msgpack::serialize_then_unwrap(UnreadMessageIndexMap::default());
        assert_eq!(bytes, [0x80]);
        let _: UnreadMessageIndexMap = msgpack::deserialize_then_unwrap(&bytes);
    }

    #[test]
    fn get_max_read_up_to_of_theirs() {
        init_stable_memory_map();
        let chat = events_prefix(1);
        let mut map = UnreadMessageIndexMap::default();
        map.add(&chat, 1.into(), 5.into());
        map.add(&chat, 2.into(), 7.into());
        map.add(&chat, 3.into(), 6.into());
        map.add(&chat, 4.into(), 8.into());
        map.add(&chat, 5.into(), 9.into());

        assert_eq!(map.get_max_read_up_to_of_theirs(&chat, &0.into()), None);
        assert_eq!(map.get_max_read_up_to_of_theirs(&chat, &3.into()), Some(7.into()));
        assert_eq!(map.get_max_read_up_to_of_theirs(&chat, &5.into()), Some(9.into()));
    }

    #[test]
    fn remove_up_to() {
        init_stable_memory_map();
        let chat = events_prefix(1);
        let mut map = UnreadMessageIndexMap::default();
        map.add(&chat, 1.into(), 5.into());
        map.add(&chat, 2.into(), 7.into());
        map.add(&chat, 3.into(), 6.into());
        map.add(&chat, 4.into(), 8.into());
        map.add(&chat, 5.into(), 9.into());

        map.remove_up_to(&chat, 0.into());
        assert_eq!(entries(&chat).len(), 5);

        map.remove_up_to(&chat, 7.into());
        assert_eq!(entries(&chat), vec![(4.into(), 8.into()), (5.into(), 9.into())]);

        map.remove_up_to(&chat, 9.into());
        assert!(entries(&chat).is_empty());
    }

    #[test]
    fn entries_are_stored_per_chat() {
        init_stable_memory_map();
        let (chat1, chat2) = (events_prefix(1), events_prefix(2));
        let mut map1 = UnreadMessageIndexMap::default();
        let mut map2 = UnreadMessageIndexMap::default();
        map1.add(&chat1, 1.into(), 10.into());
        map2.add(&chat2, 1.into(), 20.into());
        map2.add(&chat2, 2.into(), 21.into());

        assert_eq!(map1.get_max_read_up_to_of_theirs(&chat1, &5.into()), Some(10.into()));
        assert_eq!(map2.get_max_read_up_to_of_theirs(&chat2, &5.into()), Some(21.into()));

        map2.remove_up_to(&chat2, 21.into());
        assert!(entries(&chat2).is_empty());
        assert_eq!(entries(&chat1), vec![(1.into(), 10.into())]);
    }

    fn entries(events_prefix: &ChatEventKeyPrefix) -> Vec<(MessageIndex, MessageIndex)> {
        with_map(|m| {
            m.range(all_keys(events_prefix))
                .map(|(k, v)| (k.our_message_index(), value_from_bytes(&v)))
                .collect()
        })
    }

    fn events_prefix(key_id: u32) -> ChatEventKeyPrefix {
        ChatEventKeyPrefix::new_from_direct_chat_key_id(key_id, None)
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
