use crate::keys::extract_key_type;
use crate::keys::macros::key;
use crate::{BaseKeyPrefix, ChatEventKeyPrefix, KeyPrefix, KeyType};
use types::{Chat, MessageIndex, UserId};

// The search index of a chat's main events list is an inverted index made up of two sets of
// entries, both with empty values:
//
// - `SearchTokenKey`s, one for each token in each message, which are the prefix, followed by the
//   token's bytes, a 0 byte, then the message index.
// - `SearchSenderKey`s, one for each message, which are the prefix, followed by the sender's user
//   id preceded by its length, then the message index.
//
// Within each token (or sender) the message index is stored inverted (ie. `u32::MAX - index`), so
// that iterating over the keys in order yields the most recent messages first. Tokens never contain
// a 0 byte, so the 0 byte terminator ensures that the entries for one token never overlap with
// those for another token which it is a prefix of.
//
// The prefixes have the same layout as the `ChatEventKeyPrefix` of the chat's main events list,
// with only the key type differing.
key!(
    SearchTokenKey,
    SearchTokenKeyPrefix,
    KeyType::DirectChatSearchToken | KeyType::GroupChatSearchToken | KeyType::ChannelSearchToken
);

key!(
    SearchSenderKey,
    SearchSenderKeyPrefix,
    KeyType::DirectChatSearchSender | KeyType::GroupChatSearchSender | KeyType::ChannelSearchSender
);

const TOKEN_TERMINATOR: u8 = 0;

impl SearchTokenKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::new_from_events_prefix(&ChatEventKeyPrefix::new_from_chat(chat, None))
    }

    // Panics if the events prefix is for a thread, since only the main events list is indexed
    pub fn new_from_events_prefix(events_prefix: &ChatEventKeyPrefix) -> Self {
        Self::try_from(events_prefix).unwrap()
    }

    pub fn create_key_for_token(&self, token: &str, message_index: MessageIndex) -> SearchTokenKey {
        debug_assert!(!token.as_bytes().contains(&TOKEN_TERMINATOR));

        let mut bytes = Vec::with_capacity(self.0.len() + token.len() + 5);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(token.as_bytes());
        bytes.push(TOKEN_TERMINATOR);
        bytes.extend_from_slice(&invert(message_index));
        SearchTokenKey(bytes)
    }
}

// Fails if the events prefix is for a thread, since only the main events list is indexed
impl TryFrom<&ChatEventKeyPrefix> for SearchTokenKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::GroupChatEvent => KeyType::GroupChatSearchToken,
            KeyType::ChannelEvent => KeyType::ChannelSearchToken,
            KeyType::DirectChatEvent => KeyType::DirectChatSearchToken,
            _ => return Err(()),
        } as u8;
        Ok(SearchTokenKeyPrefix(bytes))
    }
}

impl KeyPrefix for SearchTokenKeyPrefix {
    type Key = SearchTokenKey;
    type Suffix = (String, MessageIndex);

    fn create_key(&self, (token, message_index): &(String, MessageIndex)) -> SearchTokenKey {
        self.create_key_for_token(token, *message_index)
    }
}

impl SearchTokenKey {
    pub fn token(&self) -> &str {
        let prefix_len = prefix_len(&self.0);
        // Tokens are only ever written from a `&str`, so they are valid UTF-8
        std::str::from_utf8(&self.0[prefix_len..self.0.len() - 5]).unwrap()
    }

    pub fn message_index(&self) -> MessageIndex {
        extract_message_index(&self.0)
    }
}

impl SearchSenderKeyPrefix {
    pub fn new_from_chat(chat: Chat) -> Self {
        Self::new_from_events_prefix(&ChatEventKeyPrefix::new_from_chat(chat, None))
    }

    // Panics if the events prefix is for a thread, since only the main events list is indexed
    pub fn new_from_events_prefix(events_prefix: &ChatEventKeyPrefix) -> Self {
        Self::try_from(events_prefix).unwrap()
    }
}

// Fails if the events prefix is for a thread, since only the main events list is indexed
impl TryFrom<&ChatEventKeyPrefix> for SearchSenderKeyPrefix {
    type Error = ();

    fn try_from(value: &ChatEventKeyPrefix) -> Result<Self, Self::Error> {
        let mut bytes = BaseKeyPrefix::from(value.clone()).0;
        bytes[0] = match extract_key_type(&bytes).unwrap() {
            KeyType::GroupChatEvent => KeyType::GroupChatSearchSender,
            KeyType::ChannelEvent => KeyType::ChannelSearchSender,
            KeyType::DirectChatEvent => KeyType::DirectChatSearchSender,
            _ => return Err(()),
        } as u8;
        Ok(SearchSenderKeyPrefix(bytes))
    }
}

impl KeyPrefix for SearchSenderKeyPrefix {
    type Key = SearchSenderKey;
    type Suffix = (UserId, MessageIndex);

    fn create_key(&self, (user_id, message_index): &(UserId, MessageIndex)) -> SearchSenderKey {
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len() + 5);
        bytes.extend_from_slice(self.0.as_slice());
        bytes.push(user_id_bytes.len() as u8);
        bytes.extend_from_slice(user_id_bytes);
        bytes.extend_from_slice(&invert(*message_index));
        SearchSenderKey(bytes)
    }
}

impl SearchSenderKey {
    pub fn message_index(&self) -> MessageIndex {
        extract_message_index(&self.0)
    }
}

fn prefix_len(key: &[u8]) -> usize {
    match extract_key_type(key).unwrap() {
        KeyType::GroupChatSearchToken | KeyType::GroupChatSearchSender => 1,
        // Key type, then the channel id (or the direct chat's key id)
        KeyType::ChannelSearchToken
        | KeyType::ChannelSearchSender
        | KeyType::DirectChatSearchToken
        | KeyType::DirectChatSearchSender => 5,
        _ => unreachable!(),
    }
}

fn invert(message_index: MessageIndex) -> [u8; 4] {
    (u32::MAX - u32::from(message_index)).to_be_bytes()
}

fn extract_message_index(key: &[u8]) -> MessageIndex {
    let start = key.len() - 4;
    (u32::MAX - u32::from_be_bytes(key[start..].try_into().unwrap())).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, RngExt, rng};
    use types::ChannelId;

    fn chats() -> Vec<(ChatEventKeyPrefix, KeyType, KeyType, usize)> {
        let channel_id = ChannelId::from(rng().next_u32());
        vec![
            (
                ChatEventKeyPrefix::new_from_direct_chat_key_id(rng().next_u32(), None),
                KeyType::DirectChatSearchToken,
                KeyType::DirectChatSearchSender,
                5,
            ),
            (
                ChatEventKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()), None),
                KeyType::GroupChatSearchToken,
                KeyType::GroupChatSearchSender,
                1,
            ),
            (
                ChatEventKeyPrefix::new_from_chat(Chat::Channel(Principal::anonymous().into(), channel_id), None),
                KeyType::ChannelSearchToken,
                KeyType::ChannelSearchSender,
                5,
            ),
        ]
    }

    #[test]
    fn search_token_key_e2e() {
        for _ in 0..100 {
            let token: String = ["abc", "東京", "x", "ünïcödé"][rng().random_range(0..4)].repeat(rng().random_range(1..4));
            let message_index = MessageIndex::from(rng().next_u32());

            for (events_prefix, key_type, _, prefix_len) in chats() {
                let prefix = SearchTokenKeyPrefix::new_from_events_prefix(&events_prefix);
                let key = BaseKey::from(prefix.create_key(&(token.clone(), message_index)));
                let token_key = SearchTokenKey::try_from(key).unwrap();

                assert_eq!(*token_key.0.first().unwrap(), key_type as u8);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert_eq!(token_key.0.len(), prefix_len + token.len() + 5);
                assert!(token_key.matches_prefix(&prefix));
                assert_eq!(token_key.token(), token);
                assert_eq!(token_key.message_index(), message_index);
                assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix.clone()).as_slice()[1..]);

                let thread_events_prefix = events_prefix.for_thread(1.into());
                assert!(SearchTokenKeyPrefix::try_from(&thread_events_prefix).is_err());

                let serialized = msgpack::serialize_then_unwrap(&token_key);
                let deserialized: SearchTokenKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, token_key);
            }
        }
    }

    #[test]
    fn search_sender_key_e2e() {
        for _ in 0..100 {
            let user_id_len = rng().random_range(0..=29);
            let user_id_bytes: Vec<u8> = (0..user_id_len).map(|_| rng().random()).collect();
            let user_id = Principal::from_slice(&user_id_bytes).into();
            let message_index = MessageIndex::from(rng().next_u32());

            for (events_prefix, _, key_type, prefix_len) in chats() {
                let prefix = SearchSenderKeyPrefix::new_from_events_prefix(&events_prefix);
                let key = BaseKey::from(prefix.create_key(&(user_id, message_index)));
                let sender_key = SearchSenderKey::try_from(key).unwrap();

                assert_eq!(*sender_key.0.first().unwrap(), key_type as u8);
                assert_eq!(key_type.map_class(), MapClass::SmallEntries);
                assert_eq!(sender_key.0.len(), prefix_len + 1 + user_id_len + 4);
                assert!(sender_key.matches_prefix(&prefix));
                assert_eq!(sender_key.message_index(), message_index);
                assert_eq!(prefix.0[1..], BaseKeyPrefix::from(events_prefix.clone()).as_slice()[1..]);

                let thread_events_prefix = events_prefix.for_thread(1.into());
                assert!(SearchSenderKeyPrefix::try_from(&thread_events_prefix).is_err());

                let serialized = msgpack::serialize_then_unwrap(&sender_key);
                let deserialized: SearchSenderKey = msgpack::deserialize_then_unwrap(&serialized);
                assert_eq!(deserialized, sender_key);
            }
        }
    }

    #[test]
    fn keys_are_ordered_by_token_then_most_recent_message_first() {
        let prefix = SearchTokenKeyPrefix::new_from_chat(Chat::Group(Principal::anonymous().into()));
        let keys: Vec<_> = [("ab", 5u32), ("ab", 0), ("abc", 10), ("abc", 1), ("b", u32::MAX)]
            .into_iter()
            .map(|(t, m)| prefix.create_key_for_token(t, m.into()))
            .collect();

        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(sorted, keys);
    }
}
