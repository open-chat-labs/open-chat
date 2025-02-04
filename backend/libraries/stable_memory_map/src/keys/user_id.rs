use crate::keys::macros::key;
use crate::{KeyPrefix, KeyType};
use ic_principal::Principal;
use types::{ChannelId, MultiUserChat, UserId};

key!(
    UserIdKey,
    UserIdKeyPrefix,
    KeyType::GroupMember | KeyType::ChannelMember | KeyType::CommunityMember
);

impl UserIdKeyPrefix {
    pub fn new_from_chat(chat: MultiUserChat) -> Self {
        match chat {
            MultiUserChat::Group(_) => Self::new_from_group(),
            MultiUserChat::Channel(_, channel_id) => Self::new_from_channel(channel_id),
        }
    }

    pub fn new_from_group() -> Self {
        // KeyType::GroupMember     1 byte
        UserIdKeyPrefix(vec![KeyType::GroupMember as u8])
    }

    pub fn new_from_channel(channel_id: ChannelId) -> Self {
        // KeyType::ChannelMember   1 byte
        // ChannelId                4 bytes
        let mut bytes = Vec::with_capacity(5);
        bytes.push(KeyType::ChannelMember as u8);
        bytes.extend_from_slice(&channel_id.as_u32().to_be_bytes());
        UserIdKeyPrefix(bytes)
    }

    pub fn new_from_community() -> Self {
        // KeyType::CommunityMember     1 byte
        UserIdKeyPrefix(vec![KeyType::CommunityMember as u8])
    }
}

impl KeyPrefix for UserIdKeyPrefix {
    type Key = UserIdKey;
    type Suffix = UserId;

    fn create_key(&self, user_id: &UserId) -> Self::Key {
        let user_id_bytes = user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + user_id_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.extend_from_slice(user_id_bytes);
        UserIdKey(bytes)
    }
}

impl UserIdKey {
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

key!(UserIdsKey, UserIdsKeyPrefix, KeyType::BlockedUsers);

impl UserIdsKeyPrefix {
    pub fn new_for_blocked_users() -> Self {
        // KeyType::BlockedUsers     1 byte
        UserIdsKeyPrefix(vec![KeyType::BlockedUsers as u8])
    }
}

impl KeyPrefix for UserIdsKeyPrefix {
    type Key = UserIdsKey;
    type Suffix = (UserId, UserId);

    fn create_key(&self, (user_id1, user_id2): &(UserId, UserId)) -> Self::Key {
        let user_id1_bytes = user_id1.as_slice();
        let user_id2_bytes = user_id2.as_slice();
        let mut bytes = Vec::with_capacity(self.0.len() + 1 + user_id1_bytes.len() + user_id2_bytes.len());
        bytes.extend_from_slice(self.0.as_slice());
        bytes.push(user_id1_bytes.len() as u8);
        bytes.extend_from_slice(user_id1_bytes);
        bytes.extend_from_slice(user_id2_bytes);
        UserIdsKey(bytes)
    }
}

impl UserIdsKey {
    pub fn user_ids(&self) -> (UserId, UserId) {
        let user_id1_len = self.0[1] as usize;
        let user_id1_end = 2 + user_id1_len;
        let user_id1 = Principal::from_slice(&self.0[2..user_id1_end]).into();
        let user_id2 = Principal::from_slice(&self.0[user_id1_end..]).into();
        (user_id1, user_id2)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{BaseKey, Key};
    use rand::{thread_rng, Rng, RngCore};

    #[test]
    fn group_chat_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = UserIdKeyPrefix::new_from_group();
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = UserIdKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::GroupMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: UserIdKey = msgpack::deserialize_then_unwrap(&serialized);
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
            let prefix = UserIdKeyPrefix::new_from_channel(channel_id);
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = UserIdKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::ChannelMember as u8);
            assert_eq!(member_key.0.len(), 15);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: UserIdKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn community_member_key_e2e() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = UserId::from(Principal::from_slice(&user_id_bytes));
            let prefix = UserIdKeyPrefix::new_from_community();
            let key = BaseKey::from(prefix.create_key(&user_id));
            let member_key = UserIdKey::try_from(key.clone()).unwrap();

            assert_eq!(*member_key.0.first().unwrap(), KeyType::CommunityMember as u8);
            assert_eq!(member_key.0.len(), 11);
            assert!(member_key.matches_prefix(&prefix));
            assert_eq!(member_key.user_id(), user_id);

            let serialized = msgpack::serialize_then_unwrap(&member_key);
            assert_eq!(serialized.len(), member_key.0.len() + 2);
            let deserialized: UserIdKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, member_key);
            assert_eq!(deserialized.0, key.0);
        }
    }

    #[test]
    fn blocked_users_key_e2e() {
        for _ in 0..100 {
            let user_id1_bytes: [u8; 10] = thread_rng().gen();
            let user_id1 = UserId::from(Principal::from_slice(&user_id1_bytes));
            let user_id2_bytes: [u8; 10] = thread_rng().gen();
            let user_id2 = UserId::from(Principal::from_slice(&user_id2_bytes));
            let prefix = UserIdsKeyPrefix::new_for_blocked_users();
            let key = BaseKey::from(prefix.create_key(&(user_id1, user_id2)));
            let blocked_users_key = UserIdsKey::try_from(key.clone()).unwrap();

            assert_eq!(*blocked_users_key.0.first().unwrap(), KeyType::BlockedUsers as u8);
            assert_eq!(blocked_users_key.0.len(), 22);
            assert!(blocked_users_key.matches_prefix(&prefix));
            assert_eq!(blocked_users_key.user_ids(), (user_id1, user_id2));

            let serialized = msgpack::serialize_then_unwrap(&blocked_users_key);
            assert_eq!(serialized.len(), blocked_users_key.0.len() + 2);
            let deserialized: UserIdsKey = msgpack::deserialize_then_unwrap(&serialized);
            assert_eq!(deserialized, blocked_users_key);
            assert_eq!(deserialized.0, key.0);
        }
    }
}
