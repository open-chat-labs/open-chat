use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::{Chat, EventIndex, TimestampMillis};

// The events in a chat's main events list which are due to expire, ordered by their expiry date.
// Only events in the main events list can expire, so there is a single set of entries per chat.
//
// The prefixes have the same layout as the `ChatEventKeyPrefix` of the chat's main events list,
// with only the key type differing.
key!(
    ExpiringEventKey,
    ExpiringEventKeyPrefix,
    KeyType::DirectChatExpiringEvent | KeyType::GroupChatExpiringEvent | KeyType::ChannelExpiringEvent
);

impl ExpiringEventKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::try_from(&ChatEventKeyPrefix::new_from_chat(chat, None)).unwrap()
    }
}

// Fails if the events prefix is for a thread, since thread events never expire
impl TryFrom<&ChatEventKeyPrefix> for ExpiringEventKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::DirectChatEvent => KeyType::DirectChatExpiringEvent,
            KeyType::GroupChatEvent => KeyType::GroupChatExpiringEvent,
            KeyType::ChannelEvent => KeyType::ChannelExpiringEvent,
            _ => return Err(()),
        } as u8;
        Ok(ExpiringEventKeyPrefix(bytes))
    }
}

impl KeyPrefix for ExpiringEventKeyPrefix {
    type Key = ExpiringEventKey;
    type Suffix = (TimestampMillis, EventIndex);

    fn create_key(&self, (expires_at, event_index): &(TimestampMillis, EventIndex)) -> ExpiringEventKey {
        let mut bytes = Vec::with_capacity(self.0.len() + 12);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&expires_at.to_be_bytes());
        bytes.extend_from_slice(&u32::from(*event_index).to_be_bytes());
        ExpiringEventKey(bytes)
    }
}

impl ExpiringEventKey {
    pub fn expires_at(&self) -> TimestampMillis {
        let start = self.0.len() - 12;
        let end = start + 8;
        u64::from_be_bytes(self.0[start..end].try_into().unwrap())
    }

    pub fn event_index(&self) -> EventIndex {
        let start = self.0.len() - 4;
        u32::from_be_bytes(self.0[start..].try_into().unwrap()).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, RngExt, rng};
    use types::{ChannelId, MessageIndex};

    #[test]
    fn expiring_event_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = rng().random();
            let user_id = Principal::from_slice(&user_id_bytes).into();
            let channel_id = ChannelId::from(rng().next_u32());
            let expires_at = rng().next_u64();
            let event_index = EventIndex::from(rng().next_u32());

            for (chat, key_type, len) in [
                (Chat::Direct(user_id), KeyType::DirectChatExpiringEvent, 24),
                (
                    Chat::Group(Principal::anonymous().into()),
                    KeyType::GroupChatExpiringEvent,
                    13,
                ),
                (
                    Chat::Channel(Principal::anonymous().into(), channel_id),
                    KeyType::ChannelExpiringEvent,
                    17,
                ),
            ] {
                let prefix = ExpiringEventKeyPrefix::new_from_chat(chat);
                let key = BaseKey::from(prefix.create_key(&(expires_at, event_index)));
                let expiring_event_key = ExpiringEventKey::try_from(key.clone()).unwrap();

                assert_eq!(*expiring_event_key.0.first().unwrap(), key_type as u8);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert_eq!(expiring_event_key.0.len(), len);
                assert!(expiring_event_key.matches_prefix(&prefix));
                assert_eq!(expiring_event_key.expires_at(), expires_at);
                assert_eq!(expiring_event_key.event_index(), event_index);

                // Other than the key type, the prefix matches the prefix of the chat's main events
                let events_prefix = ChatEventKeyPrefix::new_from_chat(chat, None);
                assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix).as_slice()[1..]);

                // Thread events never expire
                let thread_events_prefix = ChatEventKeyPrefix::new_from_chat(chat, Some(MessageIndex::from(1)));
                assert!(ExpiringEventKeyPrefix::try_from(&thread_events_prefix).is_err());

                let serialized = msgpack::serialize_then_unwrap(&expiring_event_key);
                let deserialized: ExpiringEventKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, expiring_event_key);
            }
        }
    }

    #[test]
    fn expiring_event_keys_are_ordered_by_expiry_date() {
        let prefix = ExpiringEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()));
        let mut entries: Vec<(TimestampMillis, EventIndex)> = (0..100)
            .map(|_| (rng().next_u64(), EventIndex::from(rng().next_u32())))
            .collect();
        let mut keys: Vec<_> = entries.iter().map(|e| prefix.create_key(e)).collect();

        entries.sort();
        keys.sort();

        assert_eq!(
            keys.iter().map(|k| (k.expires_at(), k.event_index())).collect::<Vec<_>>(),
            entries
        );
    }
}
