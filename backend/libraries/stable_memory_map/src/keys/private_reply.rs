use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use types::{ChatId, MessageIndex, UserId};

// The messages the user has sent in their direct chats which privately reply to a message in a
// group. If that group is later imported into a community we use these to quickly find the replies
// which need updating to point at the new channel.
//
// The keys are grouped by the group being replied to, so that all of the replies to a given group
// can be read (and then removed) with a single range scan.
key!(PrivateReplyKey, PrivateReplyKeyPrefix, KeyType::PrivateReplyToGroup);

impl PrivateReplyKeyPrefix {
    pub fn new(group_chat_id: ChatId) -> Self {
        // KeyType::PrivateReplyToGroup     1 byte
        // Group chat id length             1 byte
        // Group chat id bytes              Group chat id length bytes
        //
        // The length is included so that one group's prefix can never be a prefix of another's
        let chat_id_bytes = group_chat_id.as_slice();
        let mut bytes = Vec::with_capacity(chat_id_bytes.len() + 2);
        bytes.push(KeyType::PrivateReplyToGroup as u8);
        bytes.push(chat_id_bytes.len() as u8);
        bytes.extend_from_slice(chat_id_bytes);
        PrivateReplyKeyPrefix(bytes)
    }
}

impl KeyPrefix for PrivateReplyKeyPrefix {
    type Key = PrivateReplyKey;
    type Suffix = (UserId, MessageIndex);

    fn create_key(&self, (user_id, message_index): &(UserId, MessageIndex)) -> PrivateReplyKey {
        // Message index    4 bytes
        // User id bytes    The remaining bytes
        //
        // The message index comes first, even though the suffix is ordered the other way round,
        // because user ids vary in length. That puts the message index at a fixed offset from the
        // end of the prefix and leaves the user id as the remainder of the key, so `message_index`
        // and `user_id` can both read their values back out. Swapping the two would break both.
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + 4 + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(&u32::from(*message_index).to_be_bytes());
        bytes.extend_from_slice(user_id_bytes);
        PrivateReplyKey(bytes)
    }
}

impl PrivateReplyKey {
    pub fn message_index(&self) -> MessageIndex {
        let start = self.prefix_len();
        u32::from_be_bytes(self.0[start..start + 4].try_into().unwrap()).into()
    }

    pub fn user_id(&self) -> UserId {
        UserId::from(ic_principal::Principal::from_slice(&self.0[self.prefix_len() + 4..]))
    }

    // The prefix holds the group chat id's length in its 2nd byte
    fn prefix_len(&self) -> usize {
        usize::from(self.0[1]) + 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key, MapClass};
    use ic_principal::Principal;
    use rand::{Rng, RngExt, rng};

    #[test]
    fn private_reply_key_e2e() {
        for _ in 0..100 {
            let chat_id_bytes: [u8; 10] = rng().random();
            let chat_id = ChatId::from(Principal::from_slice(&chat_id_bytes));
            let user_id_bytes: [u8; 10] = rng().random();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let message_index = MessageIndex::from(rng().next_u32());

            let prefix = PrivateReplyKeyPrefix::new(chat_id);
            let key = prefix.create_key(&(user_id, message_index));
            let key_bytes = key.0.clone();

            // KeyType, chat id length, chat id, message index, user id
            assert_eq!(key_bytes[0], KeyType::PrivateReplyToGroup as u8);
            assert_eq!(key_bytes[1], 10);
            assert_eq!(key_bytes[2..12], chat_id_bytes);
            assert_eq!(key_bytes[12..16], u32::from(message_index).to_be_bytes());
            assert_eq!(key_bytes[16..], user_id_bytes);
            assert_eq!(key_bytes.len(), 26);
            assert_eq!(KeyType::PrivateReplyToGroup.map_class(), MapClass::SmallEntries);
            assert!(key.matches_prefix(&prefix));
            assert_eq!(key.message_index(), message_index);
            assert_eq!(key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&key);
            assert_eq!(serialized.len(), key_bytes.len() + 2);
            let deserialized: PrivateReplyKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, key);
            assert_eq!(deserialized.0, key_bytes);
            assert_eq!(BaseKey::from(deserialized).as_slice(), key_bytes.as_slice());
        }
    }

    #[test]
    fn keys_are_ordered_by_message_index() {
        let prefix = PrivateReplyKeyPrefix::new(chat(1));
        let user = UserId::from(Principal::from_slice(&[9; 10]));
        assert!(prefix.create_key(&(user, 255.into())) < prefix.create_key(&(user, 256.into())));
    }

    #[test]
    fn keys_only_match_the_prefix_of_their_own_group() {
        let prefix = PrivateReplyKeyPrefix::new(chat(1));
        let user = UserId::from(Principal::from_slice(&[9; 10]));
        let key = prefix.create_key(&(user, 1.into()));

        assert!(!key.matches_prefix(&PrivateReplyKeyPrefix::new(chat(2))));
        // A shorter chat id must not be a prefix of a longer one which starts with the same bytes
        assert!(!key.matches_prefix(&PrivateReplyKeyPrefix::new(ChatId::from(Principal::from_slice(&[1; 9])))));
    }

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }
}
