use crate::members::{default_notifications_muted, is_default_notifications_muted};
use crate::members_map::MembersMap;
use crate::{GroupMemberInternal, GroupRoleInternal, Mentions};
use candid::{Deserialize, Principal};
use serde::Serialize;
use serde_bytes::ByteBuf;
use stable_memory_map::{with_map, with_map_mut, Key, MemberKey, MemberKeyPrefix};
use std::collections::BTreeSet;
use types::{is_default, EventIndex, MessageIndex, MultiUserChat, TimestampMillis, Timestamped, UserId, UserType, Version};
use utils::timestamped_set::TimestampedSet;

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: MemberKeyPrefix,
}

impl MembersStableStorage {
    // TODO delete this after next upgrade
    pub fn new_empty() -> Self {
        MembersStableStorage {
            prefix: MemberKeyPrefix::new_from_chat(MultiUserChat::Group(Principal::anonymous().into())),
        }
    }

    #[allow(dead_code)]
    pub fn new(chat: MultiUserChat, member: GroupMemberInternal) -> Self {
        let mut map = MembersStableStorage {
            prefix: MemberKeyPrefix::new_from_chat(chat),
        };
        map.insert(member);
        map
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
    fn all_members(&self) -> Vec<GroupMemberInternal> {
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

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupMemberStableStorage {
    #[serde(rename = "d")]
    date_added: TimestampMillis,
    #[serde(rename = "r", default, skip_serializing_if = "is_default")]
    role: Timestamped<GroupRoleInternal>,
    #[serde(
        rename = "n",
        default = "default_notifications_muted",
        skip_serializing_if = "is_default_notifications_muted"
    )]
    notifications_muted: Timestamped<bool>,
    #[serde(rename = "m", default, skip_serializing_if = "Mentions::is_empty")]
    pub mentions: Mentions,
    #[serde(rename = "tf", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub followed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "tu", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub unfollowed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "p", default, skip_serializing_if = "BTreeSet::is_empty")]
    proposal_votes: BTreeSet<(TimestampMillis, MessageIndex)>,
    #[serde(rename = "pr", default, skip_serializing_if = "is_default")]
    latest_proposal_vote_removed: TimestampMillis,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    suspended: Timestamped<bool>,
    #[serde(rename = "ra", default, skip_serializing_if = "is_default")]
    pub rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", default, skip_serializing_if = "is_default")]
    user_type: UserType,
    #[serde(rename = "me", default, skip_serializing_if = "is_default")]
    min_visible_event_index: EventIndex,
    #[serde(rename = "mm", default, skip_serializing_if = "is_default")]
    min_visible_message_index: MessageIndex,
    #[serde(rename = "la", default, skip_serializing_if = "is_default")]
    lapsed: Timestamped<bool>,
}

impl GroupMemberStableStorage {
    fn hydrate(self, user_id: UserId) -> GroupMemberInternal {
        GroupMemberInternal {
            user_id,
            date_added: self.date_added,
            role: self.role,
            notifications_muted: self.notifications_muted,
            mentions: self.mentions,
            followed_threads: self.followed_threads,
            unfollowed_threads: self.unfollowed_threads,
            proposal_votes: self.proposal_votes,
            latest_proposal_vote_removed: self.latest_proposal_vote_removed,
            suspended: self.suspended,
            rules_accepted: self.rules_accepted,
            user_type: self.user_type,
            min_visible_event_index: self.min_visible_event_index,
            min_visible_message_index: self.min_visible_message_index,
            lapsed: self.lapsed,
        }
    }
}

impl From<GroupMemberInternal> for GroupMemberStableStorage {
    fn from(value: GroupMemberInternal) -> Self {
        GroupMemberStableStorage {
            date_added: value.date_added,
            role: value.role,
            notifications_muted: value.notifications_muted,
            mentions: value.mentions,
            followed_threads: value.followed_threads,
            unfollowed_threads: value.unfollowed_threads,
            proposal_votes: value.proposal_votes,
            latest_proposal_vote_removed: value.latest_proposal_vote_removed,
            suspended: value.suspended,
            rules_accepted: value.rules_accepted,
            user_type: value.user_type,
            min_visible_event_index: value.min_visible_event_index,
            min_visible_message_index: value.min_visible_message_index,
            lapsed: value.lapsed,
        }
    }
}
