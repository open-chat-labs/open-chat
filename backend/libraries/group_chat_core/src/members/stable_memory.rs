use crate::members_map::MembersMap;
use crate::GroupMemberInternal;
use candid::{Deserialize, Principal};
use serde::de::{Error, Visitor};
use serde::{Deserializer, Serialize, Serializer};
use serde_bytes::ByteBuf;
use stable_memory_map::{with_map, with_map_mut, KeyType};
use std::fmt::Formatter;
use types::{MultiUserChat, UserId};

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: KeyPrefix,
}

impl MembersStableStorage {
    // TODO delete this after next upgrade
    pub fn new_empty() -> Self {
        MembersStableStorage {
            prefix: KeyPrefix::GroupChat,
        }
    }

    #[allow(dead_code)]
    pub fn new(chat: MultiUserChat, member: GroupMemberInternal) -> Self {
        let mut map = MembersStableStorage { prefix: chat.into() };
        map.insert(member);
        map
    }

    pub fn set_chat(&mut self, chat: MultiUserChat) {
        self.prefix = chat.into();
    }

    // Used to efficiently read all members from stable memory when migrating a group into a community
    pub fn read_members_as_bytes(&self, after: Option<UserId>, max_bytes: usize) -> Vec<ByteBuf> {
        let start_key = match after {
            None => self.key(Principal::from_slice(&[]).into()),
            Some(user_id) => self.key(user_id),
        }
        .to_vec();

        with_map(|m| {
            let mut total_bytes = 0;
            m.range(start_key.clone()..)
                .skip_while(|(k, _)| *k == start_key)
                .take_while(|(k, _)| KeyPrefix::try_from(k.as_slice()).is_ok_and(|p| p == self.prefix))
                .map(|(_, v)| ByteBuf::from(v))
                .take_while(|v| {
                    total_bytes += v.len();
                    total_bytes < max_bytes
                })
                .collect()
        })
    }

    fn key(&self, user_id: UserId) -> Key {
        Key::new(self.prefix, user_id)
    }
}

impl MembersMap for MembersStableStorage {
    fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map(|m| m.get(&self.key(*user_id).to_vec()).map(|v| bytes_to_member(&v)))
    }

    fn insert(&mut self, member: GroupMemberInternal) {
        with_map_mut(|m| m.insert(self.key(member.user_id).to_vec(), member_to_bytes(&member)));
    }

    fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map_mut(|m| m.remove(&self.key(*user_id).to_vec()).map(|v| bytes_to_member(&v)))
    }

    #[cfg(test)]
    fn all_members(&self) -> Vec<GroupMemberInternal> {
        with_map(|m| {
            m.range(self.key(Principal::from_slice(&[]).into()).to_vec()..)
                .take_while(|(k, _)| Key::try_from(k.as_slice()).ok().filter(|k| k.prefix == self.prefix).is_some())
                .map(|(_, v)| bytes_to_member(&v))
                .collect()
        })
    }
}

// Used to write all members to stable memory when migrating a group into a community
pub fn write_members_from_bytes(chat: MultiUserChat, members: Vec<ByteBuf>) -> Option<UserId> {
    let prefix = chat.into();
    let mut latest = None;
    with_map_mut(|m| {
        for byte_buf in members {
            let bytes = byte_buf.into_vec();
            let member = bytes_to_member(&bytes);
            latest = Some(member.user_id);
            m.insert(Key::new(prefix, member.user_id).to_vec(), bytes);
        }
    });
    latest
}

fn member_to_bytes(member: &GroupMemberInternal) -> Vec<u8> {
    msgpack::serialize_then_unwrap(member)
}

fn bytes_to_member(bytes: &[u8]) -> GroupMemberInternal {
    msgpack::deserialize_then_unwrap(bytes)
}

#[derive(Eq, PartialEq, Ord, PartialOrd, Debug)]
pub struct Key {
    prefix: KeyPrefix,
    user_id: UserId,
}

impl Key {
    fn new(prefix: KeyPrefix, user_id: UserId) -> Self {
        Self { prefix, user_id }
    }
}

impl Key {
    fn to_vec(&self) -> Vec<u8> {
        let user_id_bytes = self.user_id.as_slice();
        let mut bytes = Vec::with_capacity(self.prefix.byte_len() + user_id_bytes.len());
        bytes.extend_from_slice(&self.prefix.to_vec());
        bytes.extend_from_slice(user_id_bytes);
        bytes
    }
}

impl TryFrom<&[u8]> for Key {
    type Error = ();

    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let prefix = KeyPrefix::try_from(value)?;
        let prefix_bytes_len = prefix.byte_len();
        let user_id = Principal::from_slice(&value[prefix_bytes_len..]).into();

        Ok(Key::new(prefix, user_id))
    }
}

#[derive(Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Debug)]
pub enum KeyPrefix {
    GroupChat,
    Channel(u32),
}

impl KeyPrefix {
    pub fn to_vec(self) -> Vec<u8> {
        match self {
            KeyPrefix::GroupChat => vec![KeyType::ChatMember as u8, 1],
            KeyPrefix::Channel(channel_id) => {
                let mut vec = Vec::with_capacity(6);
                vec.push(KeyType::ChatMember as u8);
                vec.push(2);
                vec.extend_from_slice(&channel_id.to_be_bytes());
                vec
            }
        }
    }

    fn byte_len(&self) -> usize {
        match self {
            KeyPrefix::GroupChat => 2,
            KeyPrefix::Channel(_) => 6,
        }
    }
}

impl TryFrom<&[u8]> for KeyPrefix {
    type Error = ();

    // The slice may extend beyond the bytes of the prefix
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        match value.split_first() {
            Some((kt, bytes)) if *kt == KeyType::ChatMember as u8 => match bytes.split_first() {
                Some((1, _)) => Ok(KeyPrefix::GroupChat),
                Some((2, tail)) if tail.len() >= 4 => Ok(KeyPrefix::Channel(u32::from_be_bytes(tail[..4].try_into().unwrap()))),
                _ => Err(()),
            },
            _ => Err(()),
        }
    }
}

impl From<MultiUserChat> for KeyPrefix {
    fn from(value: MultiUserChat) -> Self {
        match value {
            MultiUserChat::Group(_) => KeyPrefix::GroupChat,
            MultiUserChat::Channel(_, c) => KeyPrefix::Channel(c.as_u32()),
        }
    }
}

impl Serialize for KeyPrefix {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&self.to_vec())
    }
}

struct KeyPrefixVisitor;

impl<'de> Visitor<'de> for KeyPrefixVisitor {
    type Value = KeyPrefix;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a byte array")
    }

    fn visit_bytes<E: Error>(self, v: &[u8]) -> Result<Self::Value, E> {
        KeyPrefix::try_from(v).map_err(|_| E::custom("invalid key prefix"))
    }
}

impl<'de> Deserialize<'de> for KeyPrefix {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_bytes(KeyPrefixVisitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{thread_rng, Rng, RngCore};

    #[test]
    fn group_key_roundtrip() {
        for _ in 0..100 {
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = Principal::from_slice(&user_id_bytes).into();

            let key_in = Key::new(KeyPrefix::GroupChat, user_id);
            let bytes = key_in.to_vec();
            let key_out = Key::try_from(bytes.as_slice()).unwrap();

            assert_eq!(key_in, key_out);
        }
    }

    #[test]
    fn channel_key_roundtrip() {
        for _ in 0..100 {
            let channel_id: u32 = thread_rng().next_u32();
            let user_id_bytes: [u8; 10] = thread_rng().gen();
            let user_id = Principal::from_slice(&user_id_bytes).into();

            let key_in = Key::new(KeyPrefix::Channel(channel_id), user_id);
            let bytes = key_in.to_vec();
            let key_out = Key::try_from(bytes.as_slice()).unwrap();

            assert_eq!(key_in, key_out);
        }
    }

    #[test]
    fn group_key_prefix_serialization_roundtrip() {
        let key_prefix_in = KeyPrefix::GroupChat;
        let bytes = msgpack::serialize_then_unwrap(key_prefix_in);
        let key_prefix_out = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(key_prefix_in, key_prefix_out);
    }

    #[test]
    fn channel_key_prefix_serialization_roundtrip() {
        for _ in 0..100 {
            let channel_id: u32 = thread_rng().next_u32();
            let key_prefix_in = KeyPrefix::Channel(channel_id);
            let bytes = msgpack::serialize_then_unwrap(key_prefix_in);
            let key_prefix_out = msgpack::deserialize_then_unwrap(&bytes);

            assert_eq!(key_prefix_in, key_prefix_out);
        }
    }
}
