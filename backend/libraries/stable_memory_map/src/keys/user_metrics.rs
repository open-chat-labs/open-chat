use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{Chat, UserId};

// Each user's metrics within a chat (eg. how many messages they have sent).
//
// The prefix has the same layout as the `ChatEventKeyPrefix` of the chat's main events list, with
// only the key type differing. The key is the prefix followed by the user's id.
key!(
    UserMetricsKey,
    UserMetricsKeyPrefix,
    KeyType::DirectChatUserMetrics | KeyType::GroupChatUserMetrics | KeyType::ChannelUserMetrics
);

impl UserMetricsKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::new_from_events_prefix(&ChatEventKeyPrefix::new_from_chat(chat, None))
    }

    // Panics if the events prefix is for a thread, since metrics are stored per chat
    pub fn new_from_events_prefix(events_prefix: &ChatEventKeyPrefix) -> Self {
        Self::try_from(events_prefix).unwrap()
    }
}

// Fails if the events prefix is for a thread, since metrics are stored per chat rather than per
// events list
impl TryFrom<&ChatEventKeyPrefix> for UserMetricsKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::GroupChatEvent => KeyType::GroupChatUserMetrics,
            KeyType::ChannelEvent => KeyType::ChannelUserMetrics,
            KeyType::DirectChatEvent => KeyType::DirectChatUserMetrics,
            _ => return Err(()),
        } as u8;
        Ok(UserMetricsKeyPrefix(bytes))
    }
}

impl KeyPrefix for UserMetricsKeyPrefix {
    type Key = UserMetricsKey;
    type Suffix = UserId;

    fn create_key(&self, user_id: &UserId) -> UserMetricsKey {
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(user_id_bytes);
        UserMetricsKey(bytes)
    }
}

impl UserMetricsKey {
    pub fn user_id(&self) -> UserId {
        // User ids vary in length, so the prefix length is determined by the key type
        let prefix_len = match extract_key_type(&self.0).unwrap() {
            KeyType::GroupChatUserMetrics => 1,
            // Key type, then the channel id (or the direct chat's key id)
            KeyType::ChannelUserMetrics | KeyType::DirectChatUserMetrics => 5,
            _ => unreachable!(),
        };
        Principal::from_slice(&self.0[prefix_len..]).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use rand::{Rng, RngExt, rng};
    use types::ChannelId;

    #[test]
    fn user_metrics_keys_e2e() {
        for _ in 0..100 {
            let user_id_len = rng().random_range(0..=29);
            let user_id_bytes: Vec<u8> = (0..user_id_len).map(|_| rng().random()).collect();
            let user_id = Principal::from_slice(&user_id_bytes).into();
            let channel_id = ChannelId::from(rng().next_u32());

            for (events_prefix, key_type, prefix_len) in [
                (
                    ChatEventKeyPrefix::new_from_direct_chat_key_id(rng().next_u32(), None),
                    KeyType::DirectChatUserMetrics,
                    5,
                ),
                (
                    ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None),
                    KeyType::GroupChatUserMetrics,
                    1,
                ),
                (
                    ChatEventKeyPrefix::new_from_chat(Chat::Channel(Principal::anonymous().into(), channel_id), None),
                    KeyType::ChannelUserMetrics,
                    5,
                ),
            ] {
                let prefix = UserMetricsKeyPrefix::new_from_events_prefix(&events_prefix);
                let key = BaseKey::from(prefix.create_key(&user_id));
                let metrics_key = UserMetricsKey::try_from(key).unwrap();

                assert_eq!(*metrics_key.0.first().unwrap(), key_type as u8);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert_eq!(metrics_key.0.len(), prefix_len + user_id_len);
                assert!(metrics_key.matches_prefix(&prefix));
                assert_eq!(metrics_key.user_id(), user_id);
                assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix.clone()).as_slice()[1..]);

                let thread_events_prefix = events_prefix.for_thread(1.into());
                assert!(UserMetricsKeyPrefix::try_from(&thread_events_prefix).is_err());

                let serialized = msgpack::serialize_then_unwrap(&metrics_key);
                let deserialized: UserMetricsKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, metrics_key);
            }
        }
    }
}
