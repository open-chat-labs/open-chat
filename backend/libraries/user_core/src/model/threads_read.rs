use serde::{Deserialize, Serialize};
use stable_memory_map::{BaseKeyPrefix, KeyPrefix, ThreadReadKey, ThreadReadKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::RangeInclusive;
use types::{MessageIndex, MultiUserChat, TimestampMillis};

// How far the user has read each thread in a group or channel, keyed by the thread's root message
// index. The entries are stored in the stable memory map for small entries, so the chat must be
// passed in to identify them.
#[derive(Serialize, Deserialize, Default)]
pub struct ThreadsRead {
    #[serde(default)]
    last_updated: TimestampMillis,
}

impl ThreadsRead {
    pub fn insert(
        &mut self,
        chat: MultiUserChat,
        root_message_index: MessageIndex,
        read_up_to: MessageIndex,
        now: TimestampMillis,
    ) {
        let key = ThreadReadKeyPrefix::new_from_chat(chat).create_key(&root_message_index);
        with_map_mut(|m| m.insert(key, value_to_bytes(read_up_to, now)));
        self.last_updated = self.last_updated.max(now);
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn all(&self, chat: MultiUserChat) -> HashMap<MessageIndex, MessageIndex> {
        self.entries(chat, 0)
    }

    pub fn updated_since(&self, chat: MultiUserChat, since: TimestampMillis) -> HashMap<MessageIndex, MessageIndex> {
        if self.last_updated() <= since {
            return HashMap::new();
        }
        self.entries(chat, since)
    }

    // Moves the entries for `from` in stable memory so that they are stored against `to`, which is
    // needed when a group is imported into a community. Only stable memory is changed.
    pub fn move_entries(from: MultiUserChat, to: MultiUserChat) {
        let to_prefix = ThreadReadKeyPrefix::new_from_chat(to);
        with_map_mut(|m| {
            // The entries are in root message index order, so their new keys are in key order
            let entries: Vec<_> = m.range(keys(from)).collect();
            m.insert_many(
                entries
                    .iter()
                    .map(|(k, v)| (to_prefix.create_key(&k.root_message_index()), v.clone())),
            );
            for (key, _) in entries {
                m.remove(key);
            }
        });
    }

    pub fn stable_memory_key_prefix(chat: MultiUserChat) -> BaseKeyPrefix {
        ThreadReadKeyPrefix::new_from_chat(chat).into()
    }

    // The entries updated after `since`
    fn entries(&self, chat: MultiUserChat, since: TimestampMillis) -> HashMap<MessageIndex, MessageIndex> {
        with_map(|m| {
            m.range(keys(chat))
                .filter_map(|(k, v)| {
                    let (read_up_to, last_updated) = value_from_bytes(&v);
                    (last_updated > since).then_some((k.root_message_index(), read_up_to))
                })
                .collect()
        })
    }
}

fn keys(chat: MultiUserChat) -> RangeInclusive<ThreadReadKey> {
    let prefix = ThreadReadKeyPrefix::new_from_chat(chat);
    prefix.create_key(&MessageIndex::from(0))..=prefix.create_key(&MessageIndex::from(u32::MAX))
}

// Read up to      4 bytes
// Last updated    8 bytes
fn value_to_bytes(read_up_to: MessageIndex, last_updated: TimestampMillis) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(12);
    bytes.extend_from_slice(&u32::from(read_up_to).to_be_bytes());
    bytes.extend_from_slice(&last_updated.to_be_bytes());
    bytes
}

fn value_from_bytes(bytes: &[u8]) -> (MessageIndex, TimestampMillis) {
    let read_up_to = u32::from_be_bytes(bytes[..4].try_into().unwrap()).into();
    let last_updated = u64::from_be_bytes(bytes[4..12].try_into().unwrap());
    (read_up_to, last_updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::ChannelId;

    #[test]
    fn entries_are_stored_per_chat() {
        init_stable_memory_map();
        let group = MultiUserChat::Group(Principal::from_slice(&[1; 10]).into());
        let channel = MultiUserChat::Channel(Principal::from_slice(&[2; 10]).into(), ChannelId::from(3u32));
        let mut group_threads = ThreadsRead::default();
        let mut channel_threads = ThreadsRead::default();

        for i in 1..=10u32 {
            group_threads.insert(group, i.into(), (i * 10).into(), i as u64);
            channel_threads.insert(channel, (i + 100).into(), i.into(), i as u64 + 100);
        }
        // Updating an existing entry
        group_threads.insert(group, 5.into(), 55.into(), 20);

        assert_eq!(group_threads.last_updated(), 20);
        assert_eq!(channel_threads.last_updated(), 110);

        let all = group_threads.all(group);
        assert_eq!(all.len(), 10);
        assert_eq!(all[&MessageIndex::from(5)], MessageIndex::from(55));
        assert_eq!(all[&MessageIndex::from(10)], MessageIndex::from(100));

        let all = channel_threads.all(channel);
        assert_eq!(all.len(), 10);
        assert_eq!(all[&MessageIndex::from(101)], MessageIndex::from(1));

        let updated = group_threads.updated_since(group, 8);
        assert_eq!(updated.len(), 3);
        assert_eq!(updated[&MessageIndex::from(5)], MessageIndex::from(55));
        assert!(updated.contains_key(&MessageIndex::from(9)));
        assert!(updated.contains_key(&MessageIndex::from(10)));
        assert!(group_threads.updated_since(group, 20).is_empty());
    }

    #[test]
    fn entries_can_be_moved_to_another_chat() {
        init_stable_memory_map();
        let group = MultiUserChat::Group(Principal::from_slice(&[1; 10]).into());
        let channel = MultiUserChat::Channel(Principal::from_slice(&[2; 10]).into(), ChannelId::from(3u32));
        let mut threads = ThreadsRead::default();

        for i in 1..=10u32 {
            threads.insert(group, i.into(), (i * 10).into(), i as u64);
        }
        ThreadsRead::move_entries(group, channel);

        assert!(threads.all(group).is_empty());
        let all = threads.all(channel);
        assert_eq!(all.len(), 10);
        assert_eq!(all[&MessageIndex::from(5)], MessageIndex::from(50));
        assert_eq!(threads.updated_since(channel, 8).len(), 2);
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
