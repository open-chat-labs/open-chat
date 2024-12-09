use crate::keys::macros::key;
use crate::{BaseKey, KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{ChannelId, MultiUserChat, UserId};

key!(
    MemberKey,
    MemberKeyPrefix,
    KeyType::GroupMember | KeyType::ChannelMember | KeyType::CommunityMember
);

impl MemberKeyPrefix {
    pub fn new_from_chat(chat: MultiUserChat) -> Self {
        match chat {
            MultiUserChat::Group(_) => Self::new_from_group(),
            MultiUserChat::Channel(_, channel_id) => Self::new_from_channel(channel_id),
        }
    }

    pub fn new_from_group() -> Self {
        // KeyType::GroupMember     1 byte
        MemberKeyPrefix(vec![KeyType::GroupMember as u8])
    }

    pub fn new_from_channel(channel_id: ChannelId) -> Self {
        // KeyType::ChannelMember   1 byte
        // ChannelId                4 bytes
        let mut bytes = Vec::with_capacity(5);
        bytes.push(KeyType::ChannelMember as u8);
        bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        MemberKeyPrefix(bytes)
    }

    pub fn new_from_community() -> Self {
        // KeyType::CommunityMember     1 byte
        MemberKeyPrefix(vec![KeyType::CommunityMember as u8])
    }
}

impl KeyPrefix for MemberKeyPrefix {
    type Key = MemberKey;
    type Suffix = UserId;

    fn create_key(&self, user_id: &UserId) -> Self::Key {
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(user_id_bytes);
        MemberKey(bytes)
    }
}

impl MemberKey {
    pub fn user_id(&self) -> UserId {
        let prefix_len = match self.key_type() {
            KeyType::GroupMember | KeyType::CommunityMember => 1,
            KeyType::ChannelMember => 5,
            _ => unreachable!(),
        };
        Principal::from_slice(&self.0[prefix_len..]).into()
    }

    fn key_type(&self) -> KeyType {
        KeyType::try_from(self.0[0]).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Key;
    use rand::{thread_rng, Rng, RngCore};

    #[test]
    fn group_chat_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_group();
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::GroupMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn channel_member_key_e2e() {
        for _ in 0..100 {
            let channel_id = ChannelId::from(thread_rng().next_u32());
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_channel(channel_id);
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::ChannelMember as u8);
            assert_eq!(member_key.0.len(), 15);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn community_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = MemberKeyPrefix::new_from_community();
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = MemberKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::CommunityMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: MemberKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }
}
