use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{Chat, MessageIndex, TimestampMillis};

// The events in a user's message activity feed, ordered by timestamp, and a second set of entries
// keyed by each event's identity which map to the event's timestamp, so that an event which
// supersedes an existing one (eg. a second reaction to the same message) can find and remove it.
//
// Each user canister currently holds a single user, so the prefixes are just the key type.
key!(
    MessageActivityEventKey,
    MessageActivityEventKeyPrefix,
    KeyType::MessageActivityEvent
);
key!(
    MessageActivityEventIdKey,
    MessageActivityEventIdKeyPrefix,
    KeyType::MessageActivityEventId
);

// The fields which identify an event, so that a newer event for the same activity on the same
// message replaces the older one. The activity type is a byte assigned by the caller.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageActivityEventId {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub activity: u8,
}

impl MessageActivityEventId {
    fn write_bytes(&self, bytes: &mut Vec<u8>) {
        // Chat type                    1 byte
        // Canister id length           1 byte
        // Canister id                  Canister id length bytes
        // Channel id (channels only)   4 bytes
        // Thread root message index    1 byte marker, then 4 bytes if in a thread
        // Message index                4 bytes
        // Activity                     1 byte
        let (chat_type, canister_id, channel_id) = match self.chat {
            Chat::Direct(user_id) => (0, Principal::from(user_id), None),
            Chat::Group(chat_id) => (1, Principal::from(chat_id), None),
            Chat::Channel(community_id, channel_id) => (2, Principal::from(community_id), Some(channel_id)),
        };
        bytes.push(chat_type);
        bytes.push(canister_id.as_slice().len() as u8);
        bytes.extend_from_slice(canister_id.as_slice());
        if let Some(channel_id) = channel_id {
            bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        }
        match self.thread_root_message_index {
            None => bytes.push(0),
            Some(root_message_index) => {
                bytes.push(1);
                bytes.extend_from_slice(&u32::from(root_message_index).to_be_bytes());
            }
        }
        bytes.extend_from_slice(&u32::from(self.message_index).to_be_bytes());
        bytes.push(self.activity);
    }
}

impl MessageActivityEventKeyPrefix {
    pub fn new() -> Self {
        // KeyType::MessageActivityEvent    1 byte
        MessageActivityEventKeyPrefix(vec![KeyType::MessageActivityEvent as u8])
    }

    // A key holding just the timestamp, which sorts before every event key with that timestamp,
    // so it can be used as a range bound
    pub fn timestamp_bound(&self, timestamp: TimestampMillis) -> MessageActivityEventKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 8);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&timestamp.to_be_bytes());
        MessageActivityEventKey(bytes)
    }
}

impl Default for MessageActivityEventKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for MessageActivityEventKeyPrefix {
    type Key = MessageActivityEventKey;
    type Suffix = (TimestampMillis, MessageActivityEventId);

    fn create_key(&self, (timestamp, id): &(TimestampMillis, MessageActivityEventId)) -> MessageActivityEventKey {
        // Timestamp                8 bytes
        // Event id                 variable
        let mut bytes = Vec::with_capacity(self.0.len() + 8 + 48);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&timestamp.to_be_bytes());
        id.write_bytes(&mut bytes);
        MessageActivityEventKey(bytes)
    }
}

impl MessageActivityEventKey {
    pub fn timestamp(&self) -> TimestampMillis {
        // The prefix is just the key type
        u64::from_be_bytes(self.0[1..9].try_into().unwrap())
    }
}

impl MessageActivityEventIdKeyPrefix {
    pub fn new() -> Self {
        // KeyType::MessageActivityEventId  1 byte
        MessageActivityEventIdKeyPrefix(vec![KeyType::MessageActivityEventId as u8])
    }
}

impl Default for MessageActivityEventIdKeyPrefix {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyPrefix for MessageActivityEventIdKeyPrefix {
    type Key = MessageActivityEventIdKey;
    type Suffix = MessageActivityEventId;

    fn create_key(&self, id: &MessageActivityEventId) -> MessageActivityEventIdKey {
        // Event id                 variable
        let mut bytes = Vec::with_capacity(self.0.len() + 48);
        bytes.extend_from_slice(self.0.as_slice());
        id.write_bytes(&mut bytes);
        MessageActivityEventIdKey(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, RngExt, rng};
    use types::ChannelId;

    fn random_id() -> MessageActivityEventId {
        let canister_id_bytes: [u8; 10] = rng().random();
        let canister_id = Principal::from_slice(&canister_id_bytes);
        let chat = match rng().next_u32() % 3 {
            0 => Chat::Direct(canister_id.into()),
            1 => Chat::Group(canister_id.into()),
            _ => Chat::Channel(canister_id.into(), ChannelId::from(rng().next_u32())),
        };
        MessageActivityEventId {
            chat,
            thread_root_message_index: rng().random_bool(0.5).then(|| MessageIndex::from(rng().next_u32())),
            message_index: MessageIndex::from(rng().next_u32()),
            activity: rng().random(),
        }
    }

    fn id_len(id: &MessageActivityEventId) -> usize {
        let channel_id_len = if matches!(id.chat, Chat::Channel(..)) { 4 } else { 0 };
        let thread_len = if id.thread_root_message_index.is_some() { 5 } else { 1 };
        2 + 10 + channel_id_len + thread_len + 4 + 1
    }

    #[test]
    fn message_activity_event_key_e2e() {
        for _ in 0..100 {
            let id = random_id();
            let timestamp = rng().next_u64();

            let prefix = MessageActivityEventKeyPrefix::new();
            let key = prefix.create_key(&(timestamp, id.clone()));
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::MessageActivityEvent as u8);
            assert_eq!(key_bytes.len(), 9 + id_len(&id));
            assert_eq!(KeyType::MessageActivityEvent.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.timestamp(), timestamp);
            assert_eq!(prefix.create_key(&(timestamp, id)), key);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: MessageActivityEventKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn timestamp_bound_sorts_before_keys_with_the_same_timestamp() {
        let prefix = MessageActivityEventKeyPrefix::new();
        for _ in 0..100 {
            let id = random_id();
            let timestamp = rng().next_u64() / 2 + 1;
            let key = prefix.create_key(&(timestamp, id));

            assert!(prefix.timestamp_bound(timestamp) < key);
            assert!(prefix.timestamp_bound(timestamp - 1) < key);
            assert!(prefix.timestamp_bound(timestamp + 1) > key);
            assert!(key.matches_prefix(&prefix));
        }
    }

    #[test]
    fn message_activity_event_id_key_e2e() {
        for _ in 0..100 {
            let id = random_id();

            let prefix = MessageActivityEventIdKeyPrefix::new();
            let key = prefix.create_key(&id);
            let key_bytes = key.0.clone();

            assert_eq!(key_bytes[0], KeyType::MessageActivityEventId as u8);
            assert_eq!(key_bytes.len(), 1 + id_len(&id));
            assert_eq!(KeyType::MessageActivityEventId.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(prefix.create_key(&id), key);

            let mut other = random_id();
            other.activity = id.activity.wrapping_add(1);
            assert_ne!(prefix.create_key(&other), key);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: MessageActivityEventIdKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }
}
