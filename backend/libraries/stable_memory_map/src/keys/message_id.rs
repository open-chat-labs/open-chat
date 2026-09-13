use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::{Chat, MessageId, MessageIndex};

// Maps each message's `MessageId` to its `EventIndex`, with one set of entries per events list (ie.
// per chat and per thread).
//
// The prefixes have the same layout as `ChatEventKeyPrefix`, with only the key type differing, so
// that a list's prefix can be derived from the prefix of its events.
key!(
    MessageIdKey,
    MessageIdKeyPrefix,
    KeyType::DirectChatMessageId
        | KeyType::GroupChatMessageId
        | KeyType::ChannelMessageId
        | KeyType::DirectChatThreadMessageId
        | KeyType::GroupChatThreadMessageId
        | KeyType::ChannelThreadMessageId
);

impl MessageIdKeyPrefix {
    pub fn new_from_chat(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        Self::from(&ChatEventKeyPrefix::new_from_chat(chat, thread_root_message_index))
    }
}

impl From<&ChatEventKeyPrefix> for MessageIdKeyPrefix {
    fn from(value: &ChatEventKeyPrefix) -> Self {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::DirectChatEvent => KeyType::DirectChatMessageId,
            KeyType::GroupChatEvent => KeyType::GroupChatMessageId,
            KeyType::ChannelEvent => KeyType::ChannelMessageId,
            KeyType::DirectChatThreadEvent => KeyType::DirectChatThreadMessageId,
            KeyType::GroupChatThreadEvent => KeyType::GroupChatThreadMessageId,
            KeyType::ChannelThreadEvent => KeyType::ChannelThreadMessageId,
            key_type => unreachable!("Unexpected key type for a chat event: {key_type:?}"),
        } as u8;
        MessageIdKeyPrefix(bytes)
    }
}

impl KeyPrefix for MessageIdKeyPrefix {
    type Key = MessageIdKey;
    type Suffix = MessageId;

    fn create_key(&self, message_id: &MessageId) -> MessageIdKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 8);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&message_id.as_u64().to_be_bytes());
        MessageIdKey(bytes)
    }
}

impl MessageIdKey {
    pub fn message_id(&self) -> MessageId {
        let start = self.0.len() - 8;
        u64::from_be_bytes(self.0[start..].try_into().unwrap()).into()
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
    fn message_id_key_e2e() {
        for thread in [false, true] {
            for _ in 0..100 {
                let user_id_bytes: [u8; 10] = rng().random();
                let user_id = Principal::from_slice(&user_id_bytes).into();
                let channel_id = ChannelId::from(rng().next_u32());
                let thread_root_message_index = thread.then(|| MessageIndex::from(rng().next_u32()));
                let message_id = MessageId::from(rng().next_u64());

                for (chat, key_type, len) in [
                    (
                        Chat::Direct(user_id),
                        if thread { KeyType::DirectChatThreadMessageId } else { KeyType::DirectChatMessageId },
                        20,
                    ),
                    (
                        Chat::Group(Principal::anonymous().into()),
                        if thread { KeyType::GroupChatThreadMessageId } else { KeyType::GroupChatMessageId },
                        9,
                    ),
                    (
                        Chat::Channel(Principal::anonymous().into(), channel_id),
                        if thread { KeyType::ChannelThreadMessageId } else { KeyType::ChannelMessageId },
                        13,
                    ),
                ] {
                    let prefix = MessageIdKeyPrefix::new_from_chat(chat, thread_root_message_index);
                    let key = BaseKey::from(prefix.create_key(&message_id));
                    let message_id_key = MessageIdKey::try_from(key.clone()).unwrap();

                    assert_eq!(*message_id_key.0.first().unwrap(), key_type as u8);
                    assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                    assert_eq!(message_id_key.0.len(), if thread { len + 4 } else { len });
                    assert!(message_id_key.matches_prefix(&prefix));
                    assert_eq!(message_id_key.message_id(), message_id);

                    // Other than the key type, the prefix matches the prefix of the list's events
                    let events_prefix = ChatEventKeyPrefix::new_from_chat(chat, thread_root_message_index);
                    assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix).as_slice()[1..]);

                    let serialized = msgpack::serialize_then_unwrap(&message_id_key);
                    let deserialized: MessageIdKey = msgpack::deserialize_then_unwrap(&serialized);
                    assert_eq!(deserialized, message_id_key);
                }
            }
        }
    }
}
