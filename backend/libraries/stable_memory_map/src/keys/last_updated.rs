use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::{Chat, EventIndex, MessageIndex, TimestampMillis};

// When each event in a chat (including events in threads) was last updated, so that clients can be
// told which events have changed. There are two sets of entries per chat, one mapping each event to
// the time it was last updated, and one ordered by that time.
//
// The prefixes have the same layout as the `ChatEventKeyPrefix` of the chat's main events list,
// with only the key type differing.
key!(
    EventLastUpdatedKey,
    EventLastUpdatedKeyPrefix,
    KeyType::DirectChatEventLastUpdated | KeyType::GroupChatEventLastUpdated | KeyType::ChannelEventLastUpdated
);

key!(
    EventsByLastUpdatedKey,
    EventsByLastUpdatedKeyPrefix,
    KeyType::DirectChatEventsByLastUpdated | KeyType::GroupChatEventsByLastUpdated | KeyType::ChannelEventsByLastUpdated
);

// Each event is identified by its thread (if any) followed by its event index, which is encoded as
// a fixed length suffix so that keys can be parsed from the end:
// Thread flag (0 = main events list, 1 = thread)   1 byte
// Thread root message index (0 if not a thread)    4 bytes
// Event index                                      4 bytes
const EVENT_SUFFIX_LEN: usize = 9;

impl EventLastUpdatedKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::try_from(&ChatEventKeyPrefix::new_from_chat(chat, None)).unwrap()
    }
}

// Fails if the events prefix is for a thread, since the entries for events in threads are stored
// under the prefix of the chat's main events list
impl TryFrom<&ChatEventKeyPrefix> for EventLastUpdatedKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::DirectChatEvent => KeyType::DirectChatEventLastUpdated,
            KeyType::GroupChatEvent => KeyType::GroupChatEventLastUpdated,
            KeyType::ChannelEvent => KeyType::ChannelEventLastUpdated,
            _ => return Err(()),
        } as u8;
        Ok(EventLastUpdatedKeyPrefix(bytes))
    }
}

impl EventsByLastUpdatedKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::try_from(&ChatEventKeyPrefix::new_from_chat(chat, None)).unwrap()
    }
}

// Fails if the events prefix is for a thread, since the entries for events in threads are stored
// under the prefix of the chat's main events list
impl TryFrom<&ChatEventKeyPrefix> for EventsByLastUpdatedKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::DirectChatEvent => KeyType::DirectChatEventsByLastUpdated,
            KeyType::GroupChatEvent => KeyType::GroupChatEventsByLastUpdated,
            KeyType::ChannelEvent => KeyType::ChannelEventsByLastUpdated,
            _ => return Err(()),
        } as u8;
        Ok(EventsByLastUpdatedKeyPrefix(bytes))
    }
}

impl KeyPrefix for EventLastUpdatedKeyPrefix {
    type Key = EventLastUpdatedKey;
    type Suffix = (Option<MessageIndex>, EventIndex);

    fn create_key(&self, (thread_root_message_index, event_index): &(Option<MessageIndex>, EventIndex)) -> EventLastUpdatedKey {
        let mut bytes = Vec::with_capacity(self.0.len() + EVENT_SUFFIX_LEN);
        bytes.extend_from_slice(self.0.as_slice());
        write_event_suffix(&mut bytes, *thread_root_message_index, *event_index);
        EventLastUpdatedKey(bytes)
    }
}

impl KeyPrefix for EventsByLastUpdatedKeyPrefix {
    type Key = EventsByLastUpdatedKey;
    type Suffix = (TimestampMillis, Option<MessageIndex>, EventIndex);

    fn create_key(
        &self,
        (last_updated, thread_root_message_index, event_index): &(TimestampMillis, Option<MessageIndex>, EventIndex),
    ) -> EventsByLastUpdatedKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 8 + EVENT_SUFFIX_LEN);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&last_updated.to_be_bytes());
        write_event_suffix(&mut bytes, *thread_root_message_index, *event_index);
        EventsByLastUpdatedKey(bytes)
    }
}

impl EventLastUpdatedKey {
    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        read_event_suffix(&self.0).0
    }

    pub fn event_index(&self) -> EventIndex {
        read_event_suffix(&self.0).1
    }
}

impl EventsByLastUpdatedKey {
    pub fn last_updated(&self) -> TimestampMillis {
        let start = self.0.len() - EVENT_SUFFIX_LEN - 8;
        let end = start + 8;
        u64::from_be_bytes(self.0[start..end].try_into().unwrap())
    }

    pub fn thread_root_message_index(&self) -> Option<MessageIndex> {
        read_event_suffix(&self.0).0
    }

    pub fn event_index(&self) -> EventIndex {
        read_event_suffix(&self.0).1
    }
}

fn write_event_suffix(bytes: &mut Vec<u8>, thread_root_message_index: Option<MessageIndex>, event_index: EventIndex) {
    match thread_root_message_index {
        None => bytes.extend_from_slice(&[0; 5]),
        Some(root_message_index) => {
            bytes.push(1);
            bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
        }
    }
    bytes.extend_from_slice(&u32::from(event_index).to_be_bytes());
}

fn read_event_suffix(bytes: &[u8]) -> (Option<MessageIndex>, EventIndex) {
    let start = bytes.len() - EVENT_SUFFIX_LEN;
    let thread_root_message_index =
        (bytes[start] == 1).then(|| u32::from_be_bytes(bytes[start + 1..start + 5].try_into().unwrap()).into());
    let event_index = u32::from_be_bytes(bytes[start + 5..].try_into().unwrap()).into();
    (thread_root_message_index, event_index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, RngExt, rng};
    use types::ChannelId;

    #[test]
    fn last_updated_keys_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let user_id_bytes: [u8; 10] = rng().random();
                let user_id = Principal::from_slice(&user_id_bytes).into();
                let channel_id = ChannelId::from(rng().next_u32());
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let event_index = EventIndex::from(rng().next_u32());
                let last_updated = rng().next_u64();

                for (chat, key_types, prefix_len) in [
                    (
                        Chat::Direct(user_id),
                        (KeyType::DirectChatEventLastUpdated, KeyType::DirectChatEventsByLastUpdated),
                        12,
                    ),
                    (
                        Chat::Group(Principal::anonymous().into()),
                        (KeyType::GroupChatEventLastUpdated, KeyType::GroupChatEventsByLastUpdated),
                        1,
                    ),
                    (
                        Chat::Channel(Principal::anonymous().into(), channel_id),
                        (KeyType::ChannelEventLastUpdated, KeyType::ChannelEventsByLastUpdated),
                        5,
                    ),
                ] {
                    let events_prefix = ChatEventKeyPrefix::new_from_chat(chat, None);

                    let prefix = EventLastUpdatedKeyPrefix::new_from_chat(chat);
                    let key = BaseKey::from(prefix.create_key(&(thread_root_message_index, event_index)));
                    let last_updated_key = EventLastUpdatedKey::try_from(key).unwrap();

                    assert_eq!(*last_updated_key.0.first().unwrap(), key_types.0 as u8);
                    assert_eq!(key_types.0.map_class(), MapClass::SmallEntries);
                    assert_eq!(last_updated_key.0.len(), prefix_len + 9);
                    assert!(last_updated_key.matches_prefix(&prefix));
                    assert_eq!(last_updated_key.thread_root_message_index(), thread_root_message_index);
                    assert_eq!(last_updated_key.event_index(), event_index);
                    assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix.clone()).as_slice()[1..]);

                    let serialized = msgpack::serialize_then_unwrap(&last_updated_key);
                    let deserialized: EventLastUpdatedKey = msgpack::deserialize_then_unwrap(&serialized);
                    assert_eq!(deserialized, last_updated_key);

                    let prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(chat);
                    let key = BaseKey::from(prefix.create_key(&(last_updated, thread_root_message_index, event_index)));
                    let by_last_updated_key = EventsByLastUpdatedKey::try_from(key).unwrap();

                    assert_eq!(*by_last_updated_key.0.first().unwrap(), key_types.1 as u8);
                    assert_eq!(key_types.1.map_class(), MapClass::SmallEntries);
                    assert_eq!(by_last_updated_key.0.len(), prefix_len + 17);
                    assert!(by_last_updated_key.matches_prefix(&prefix));
                    assert_eq!(by_last_updated_key.last_updated(), last_updated);
                    assert_eq!(by_last_updated_key.thread_root_message_index(), thread_root_message_index);
                    assert_eq!(by_last_updated_key.event_index(), event_index);
                    assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix).as_slice()[1..]);

                    let thread_events_prefix = ChatEventKeyPrefix::new_from_chat(chat, Some(1.into()));
                    assert!(EventLastUpdatedKeyPrefix::try_from(&thread_events_prefix).is_err());
                    assert!(EventsByLastUpdatedKeyPrefix::try_from(&thread_events_prefix).is_err());

                    let serialized = msgpack::serialize_then_unwrap(&by_last_updated_key);
                    let deserialized: EventsByLastUpdatedKey = msgpack::deserialize_then_unwrap(&serialized);
                    assert_eq!(deserialized, by_last_updated_key);
                }
            }
        }
    }

    #[test]
    fn events_by_last_updated_keys_are_ordered_by_timestamp() {
        let prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()));
        let mut entries: Vec<(TimestampMillis, Option<MessageIndex>, EventIndex)> = (0..100)
            .map(|_| {
                (
                    rng().next_u64(),
                    rng().random_bool(0.5).then(|| MessageIndex::from(rng().next_u32())),
                    EventIndex::from(rng().next_u32()),
                )
            })
            .collect();
        let mut keys: Vec<_> = entries.iter().map(|e| prefix.create_key(e)).collect();

        entries.sort();
        keys.sort();

        assert_eq!(
            keys.iter()
                .map(|k| (k.last_updated(), k.thread_root_message_index(), k.event_index()))
                .collect::<Vec<_>>(),
            entries
        );
    }
}
