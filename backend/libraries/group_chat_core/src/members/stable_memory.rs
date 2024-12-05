use crate::members_map::MembersMap;
use crate::{GroupMemberInternal, GroupMemberStableStorage};
use candid::{Deserialize, Principal};
use serde::Serialize;
use serde_bytes::ByteBuf;
use stable_memory_map::{with_map, with_map_mut, Key, MemberKey, MemberKeyPrefix};
use types::{MultiUserChat, UserId};

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: MemberKeyPrefix,
}

impl MembersStableStorage {
    pub fn new(chat: MultiUserChat, member: GroupMemberInternal) -> Self {
        let mut map = MembersStableStorage {
            prefix: MemberKeyPrefix::new_from_chat(chat),
        };
        map.insert(member);
        map
    }

    pub fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map(|m| m.get(&self.prefix.create_key(*user_id).into()).map(|v| bytes_to_member(&v)))
    }

    pub fn insert(&mut self, member: GroupMemberInternal) {
        with_map_mut(|m| m.insert(self.prefix.create_key(member.user_id).into(), member_to_bytes(&member)));
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map_mut(|m| {
            m.remove(&self.prefix.create_key(*user_id).into())
                .map(|v| bytes_to_member(&v))
        })
    }

    pub fn set_chat(&mut self, chat: MultiUserChat) {
        self.prefix = MemberKeyPrefix::new_from_chat(chat);
    }

    // Used to efficiently read all members from stable memory when migrating a group into a community
    pub fn read_members_as_bytes(&self, after: Option<UserId>, max_bytes: usize) -> Vec<(UserId, ByteBuf)> {
        let start_key = match after {
            None => self.prefix.create_key(Principal::from_slice(&[]).into()),
            Some(user_id) => self.prefix.create_key(user_id),
        };

        with_map(|m| {
            let mut total_bytes = 0;
            m.range(Key::from(start_key.clone())..)
                .map_while(|(k, v)| MemberKey::try_from(k).ok().map(|k| (k, v)))
                .skip_while(|(k, _)| *k == start_key)
                .take_while(|(k, v)| {
                    if !k.matches_prefix(&self.prefix) {
                        return false;
                    }
                    total_bytes += v.len();
                    total_bytes < max_bytes
                })
                .map(|(k, v)| (k.user_id(), ByteBuf::from(v)))
                .collect()
        })
    }
}

impl MembersMap for MembersStableStorage {
    fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map(|m| {
            m.get(&self.prefix.create_key(*user_id).into())
                .map(|v| bytes_to_member(&v).hydrate(*user_id))
        })
    }

    fn insert(&mut self, member: GroupMemberInternal) {
        with_map_mut(|m| m.insert(self.prefix.create_key(member.user_id).into(), member_to_bytes(member.into())));
    }

    fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        with_map_mut(|m| {
            m.remove(&self.prefix.create_key(*user_id).into())
                .map(|v| bytes_to_member(&v).hydrate(*user_id))
        })
    }

    #[cfg(test)]
    pub fn all_members(&self) -> Vec<GroupMemberInternal> {
        with_map(|m| {
            m.range(Key::from(self.prefix.create_key(Principal::from_slice(&[]).into()))..)
                .map_while(|(k, v)| MemberKey::try_from(k).ok().map(|k| (k, v)))
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .map(|(k, v)| bytes_to_member(&v).hydrate(k.user_id()))
                .collect()
        })
    }
}

// Used to write all members to stable memory when migrating a group into a community
pub fn write_members_from_bytes(chat: MultiUserChat, members: Vec<(UserId, ByteBuf)>) -> Option<UserId> {
    let prefix = MemberKeyPrefix::new_from_chat(chat);
    let mut latest = None;
    with_map_mut(|m| {
        for (user_id, byte_buf) in members {
            let bytes = byte_buf.into_vec();
            // Check that the bytes are valid
            let _ = bytes_to_member(&bytes);
            latest = Some(user_id);
            m.insert(prefix.create_key(user_id).into(), bytes);
        }
    });
    latest
}

fn member_to_bytes(member: GroupMemberStableStorage) -> Vec<u8> {
    msgpack::serialize_then_unwrap(member)
}

fn bytes_to_member(bytes: &[u8]) -> GroupMemberStableStorage {
    msgpack::deserialize_then_unwrap(bytes)
}
