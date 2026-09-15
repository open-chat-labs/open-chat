use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::{Chat, MessageIndex};

// Maps each message's `MessageIndex` to its `EventIndex`, with one set of entries per events list
// (ie. per chat and per thread). The event indexes are stored in fixed size chunks, each keyed by
// its chunk index (ie. the message index of its first message divided by the chunk size).
//
// The prefixes have the same layout as `ChatEventKeyPrefix`, with only the key type differing, so
// that a list's prefix can be derived from the prefix of its events.
key!(
    MessageEventIndexesKey,
    MessageEventIndexesKeyPrefix,
    KeyType::DirectChatMessageEventIndexes
        | KeyType::GroupChatMessageEventIndexes
        | KeyType::ChannelMessageEventIndexes
        | KeyType::DirectChatThreadMessageEventIndexes
        | KeyType::GroupChatThreadMessageEventIndexes
        | KeyType::ChannelThreadMessageEventIndexes
        | KeyType::DirectChatMessageEventIndexesV2
        | KeyType::DirectChatThreadMessageEventIndexesV2
);

impl MessageEventIndexesKeyPrefix {
    pub fn new_from_chat(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        Self::from(&ChatEventKeyPrefix::new_from_chat(chat, thread_root_message_index))
    }
}

impl From<&ChatEventKeyPrefix> for MessageEventIndexesKeyPrefix {
    fn from(value: &ChatEventKeyPrefix) -> Self {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::DirectChatEvent => KeyType::DirectChatMessageEventIndexes,
            KeyType::GroupChatEvent => KeyType::GroupChatMessageEventIndexes,
            KeyType::ChannelEvent => KeyType::ChannelMessageEventIndexes,
            KeyType::DirectChatThreadEvent => KeyType::DirectChatThreadMessageEventIndexes,
            KeyType::GroupChatThreadEvent => KeyType::GroupChatThreadMessageEventIndexes,
            KeyType::ChannelThreadEvent => KeyType::ChannelThreadMessageEventIndexes,
            KeyType::DirectChatEventV2 => KeyType::DirectChatMessageEventIndexesV2,
            KeyType::DirectChatThreadEventV2 => KeyType::DirectChatThreadMessageEventIndexesV2,
            key_type => unreachable!("Unexpected key type for a chat event: {key_type:?}"),
        } as u8;
        MessageEventIndexesKeyPrefix(bytes)
    }
}

impl KeyPrefix for MessageEventIndexesKeyPrefix {
    type Key = MessageEventIndexesKey;
    // The chunk index
    type Suffix = u32;

    fn create_key(&self, chunk_index: &u32) -> MessageEventIndexesKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 4);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&chunk_index.to_be_bytes());
        MessageEventIndexesKey(bytes)
    }
}

impl MessageEventIndexesKey {
    pub fn chunk_index(&self) -> u32 {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, RngExt, rng};
    use types::ChannelId;

    #[test]
    fn message_event_indexes_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let user_id_bytes: [u8; 10] = rng().random();
                let user_id = Principal::from_slice(&user_id_bytes).into();
                let channel_id = ChannelId::from(rng().next_u32());
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let chunk_index = rng().next_u32();

                for (chat, key_type, len) in [
                    (
                        Chat::Direct(user_id),
                        if thread {
                            KeyType::DirectChatThreadMessageEventIndexes
                        } else {
                            KeyType::DirectChatMessageEventIndexes
                        },
                        16,
                    ),
                    (
                        Chat::Group(Principal::anonymous().into()),
                        if thread {
                            KeyType::GroupChatThreadMessageEventIndexes
                        } else {
                            KeyType::GroupChatMessageEventIndexes
                        },
                        5,
                    ),
                    (
                        Chat::Channel(Principal::anonymous().into(), channel_id),
                        if thread { KeyType::ChannelThreadMessageEventIndexes } else { KeyType::ChannelMessageEventIndexes },
                        9,
                    ),
                ] {
                    let prefix = MessageEventIndexesKeyPrefix::new_from_chat(chat, thread_root_message_index);
                    let key = BaseKey::from(prefix.create_key(&chunk_index));
                    let message_event_indexes_key = MessageEventIndexesKey::try_from(key.clone()).unwrap();

                    assert_eq!(*message_event_indexes_key.0.first().unwrap(), key_type as u8);
                    assert_eq!(key_type.map_class(), MapClass::Default);
                    assert_eq!(message_event_indexes_key.0.len(), if thread { len + 4 } else { len });
                    assert!(message_event_indexes_key.matches_prefix(&prefix));
                    assert_eq!(message_event_indexes_key.chunk_index(), chunk_index);

                    // Other than the key type, the prefix matches the prefix of the list's events
                    let events_prefix = ChatEventKeyPrefix::new_from_chat(chat, thread_root_message_index);
                    assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix).as_slice()[1..]);

                    let serialized = msgpack::serialize_then_unwrap(&message_event_indexes_key);
                    let deserialized: MessageEventIndexesKey = msgpack::deserialize_then_unwrap(&serialized);
                    assert_eq!(deserialized, message_event_indexes_key);
                }
            }
        }
    }
}
