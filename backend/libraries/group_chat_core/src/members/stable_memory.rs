use crate::{GroupMemberInternal, GroupMemberStableStorage};
use candid::{Deserialize, Principal};
use serde::Serialize;
use serde_bytes::ByteBuf;
use stable_memory_map::{with_map, with_map_mut, Key, KeyPrefix, MemberKeyPrefix, StableMemoryMap};
use types::{MultiUserChat, UserId};

#[derive(Serialize, Deserialize)]
#[serde(from = "MembersStableStoragePrevious")]
pub struct MembersStableStorage {
    map: StableMemoryMap<MemberKeyPrefix, GroupMemberStableStorage>,
    prefix: MemberKeyPrefix,
}

#[derive(Serialize, Deserialize)]
struct MembersStableStoragePrevious {
    prefix: MemberKeyPrefix,
}

impl From<MembersStableStoragePrevious> for MembersStableStorage {
    fn from(value: MembersStableStoragePrevious) -> Self {
        MembersStableStorage {
            map: StableMemoryMap::new(value.prefix.clone()),
            prefix: value.prefix,
        }
    }
}

impl MembersStableStorage {
    pub fn new(chat: MultiUserChat, member: GroupMemberInternal) -> Self {
        let prefix = MemberKeyPrefix::new_from_chat(chat);
        let mut map = MembersStableStorage {
            map: StableMemoryMap::new(prefix.clone()),
            prefix,
        };
        map.insert(member);
        map
    }

    pub fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.get(user_id).map(|m| m.hydrate(*user_id))
    }

    pub fn insert(&mut self, member: GroupMemberInternal) {
        let user_id = member.user_id;
        self.map.insert(&user_id, &(member.into()));
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.remove(user_id).map(|m| m.hydrate(*user_id))
    }

    pub fn set_chat(&mut self, chat: MultiUserChat) {
        let prefix = MemberKeyPrefix::new_from_chat(chat);
        self.map = StableMemoryMap::new(prefix.clone());
        self.prefix = prefix;
    }

    // Used to efficiently read all members from stable memory when migrating a group into a community
    pub fn read_members_as_bytes(&self, after: Option<UserId>, max_bytes: usize) -> Vec<(UserId, ByteBuf)> {
        let start_key = match after {
            None => self.map.prefix().create_key(&Principal::from_slice(&[]).into()),
            Some(user_id) => self.map.prefix().create_key(&user_id),
        };

        with_map(|m| {
            let mut total_bytes = 0;
            m.range(start_key.clone()..)
                .skip_while(|(k, _)| *k == start_key)
                .take_while(|(k, v)| {
                    if !k.matches_prefix(self.map.prefix()) {
                        return false;
                    }
                    total_bytes += v.len();
                    total_bytes < max_bytes
                })
                .map(|(k, v)| (k.user_id(), ByteBuf::from(v)))
                .collect()
        })
    }

    #[cfg(test)]
    pub fn all_members(&self) -> Vec<GroupMemberInternal> {
        with_map(|m| {
            m.range(self.map.prefix().create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(self.map.prefix()))
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
            m.insert(prefix.create_key(&user_id), bytes);
        }
    });
    latest
}

fn bytes_to_member(bytes: &[u8]) -> GroupMemberStableStorage {
    msgpack::deserialize_then_unwrap(bytes)
}
