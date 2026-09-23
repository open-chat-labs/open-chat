use crate::{GroupMemberInternal, GroupMemberStableStorage};
use candid::{Deserialize, Principal};
use serde::Serialize;
use serde_bytes::ByteBuf;
use stable_memory_map::{Key, KeyPrefix, StableMemoryMap, UserIdKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::Bound;
use types::{MultiUserChat, UserId};

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: UserIdKeyPrefix,
}

impl StableMemoryMap<UserIdKeyPrefix, GroupMemberInternal> for MembersStableStorage {
    fn prefix(&self) -> &UserIdKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: GroupMemberInternal) -> Vec<u8> {
        member_to_bytes(value.into())
    }

    fn bytes_to_value(user_id: &UserId, bytes: Vec<u8>) -> GroupMemberInternal {
        bytes_to_member(&bytes).hydrate(*user_id)
    }
}

impl MembersStableStorage {
    pub fn new(chat: MultiUserChat, member: GroupMemberInternal) -> Self {
        let mut map = MembersStableStorage {
            prefix: UserIdKeyPrefix::new_from_chat(chat),
        };
        map.insert(member.user_id, member);
        map
    }

    pub fn set_chat(&mut self, chat: MultiUserChat) {
        self.prefix = UserIdKeyPrefix::new_from_chat(chat);
    }

    // Used to efficiently read all members from stable memory when migrating a group into a community
    pub fn read_members_as_bytes(&self, after: Option<UserId>, max_bytes: usize) -> Vec<(UserId, ByteBuf)> {
        let start_key = match after {
            None => self.prefix.create_key(&Principal::from_slice(&[]).into()),
            Some(user_id) => self.prefix.create_key(&user_id),
        };

        with_map(|m| {
            let mut total_bytes = 0;
            m.range(start_key.clone()..)
                .skip_while(|(k, _)| *k == start_key)
                .take_while(|(k, v)| {
                    if !k.matches_prefix(&self.prefix) {
                        return false;
                    }
                    total_bytes += 10; // Doesn't need to be exact and UserIds are usually 10 bytes
                    total_bytes += v.len();
                    total_bytes < max_bytes
                })
                .map(|(k, v)| (k.user_id(), ByteBuf::from(remove_principal(v))))
                .collect()
        })
    }

    // Reads and writes the members in batches so that each modified node is written to stable
    // memory at most once per batch. Returns the number of members updated.
    pub fn populate_principals(&mut self, principals: &HashMap<UserId, Principal>) -> u32 {
        const BATCH_SIZE: usize = 1000;

        let mut updated = 0;
        let mut start = Bound::Included(self.prefix.create_key(&Principal::from_slice(&[]).into()));
        loop {
            let batch: Vec<_> = with_map(|m| {
                m.range((start.clone(), Bound::Unbounded))
                    .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                    .take(BATCH_SIZE)
                    .collect()
            });

            let Some((last_key, _)) = batch.last() else {
                break;
            };
            start = Bound::Excluded(last_key.clone());
            let batch_len = batch.len();

            let to_update: Vec<_> = batch
                .into_iter()
                .filter_map(|(key, bytes)| {
                    let principal = *principals.get(&key.user_id())?;
                    let mut member = bytes_to_member(&bytes);
                    (member.principal != Some(principal)).then(|| {
                        member.principal = Some(principal);
                        (key, member_to_bytes(member))
                    })
                })
                .collect();

            updated += to_update.len() as u32;
            with_map_mut(|m| m.insert_many(to_update));

            if batch_len < BATCH_SIZE {
                break;
            }
        }
        updated
    }

    #[cfg(test)]
    pub fn all_members(&self) -> Vec<GroupMemberInternal> {
        with_map(|m| {
            m.range(self.prefix.create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .map(|(k, v)| bytes_to_member(&v).hydrate(k.user_id()))
                .collect()
        })
    }
}

// Used to write all members to stable memory when migrating a group into a community
pub fn write_members_from_bytes(chat: MultiUserChat, members: Vec<(UserId, ByteBuf)>) -> Option<UserId> {
    let prefix = UserIdKeyPrefix::new_from_chat(chat);
    let latest = members.last().map(|(user_id, _)| *user_id);
    // The members are exported in key order, so they can be inserted in bulk efficiently
    let entries: Vec<_> = members
        .into_iter()
        .map(|(user_id, byte_buf)| {
            let bytes = byte_buf.into_vec();
            // Check that the bytes are valid
            let _ = bytes_to_member(&bytes);
            (prefix.create_key(&user_id), bytes)
        })
        .collect();
    with_map_mut(|m| m.insert_many(entries));
    latest
}

// Principals are only stored for members of Group canisters, so they are removed when exporting members
// into a community, where channel members have them set to None
fn remove_principal(bytes: Vec<u8>) -> Vec<u8> {
    let mut member = bytes_to_member(&bytes);
    if member.principal.take().is_some() { member_to_bytes(member) } else { bytes }
}

fn member_to_bytes(member: GroupMemberStableStorage) -> Vec<u8> {
    msgpack::serialize_then_unwrap(member)
}

fn bytes_to_member(bytes: &[u8]) -> GroupMemberStableStorage {
    msgpack::deserialize_then_unwrap(bytes)
}
