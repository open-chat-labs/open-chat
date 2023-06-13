use crate::mentions::Mentions;
use crate::roles::GroupRoleInternal;
use chat_events::ChatEvents;
use serde::de::{SeqAccess, Visitor};
use serde::ser::SerializeSeq;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fmt::Formatter;
use types::{
    is_default, is_empty_btreemap, is_empty_hashset, EventIndex, GroupMember, GroupPermissions, Mention, MessageIndex,
    TimestampMillis, Timestamped, UserId, MAX_RETURNED_MENTIONS,
};

const MAX_MEMBERS_PER_GROUP: u32 = 100_000;

#[derive(Serialize, Deserialize, Default)]
pub struct GroupMembers {
    #[serde(serialize_with = "serialize_members", deserialize_with = "deserialize_members")]
    pub members: HashMap<UserId, GroupMemberInternal>,
    pub blocked: HashSet<UserId>,
    pub moderator_count: u32,
    pub admin_count: u32,
    pub owner_count: u32,
}

#[allow(clippy::too_many_arguments)]
impl GroupMembers {
    pub fn new(creator_user_id: UserId, now: TimestampMillis) -> GroupMembers {
        let member = GroupMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: GroupRoleInternal::Owner,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: Timestamped::new(false, now),
            mentions_v2: Mentions::default(),
            threads: HashSet::new(),
            proposal_votes: BTreeMap::default(),
            suspended: Timestamped::default(),
        };

        GroupMembers {
            members: vec![(creator_user_id, member)].into_iter().collect(),
            blocked: HashSet::new(),
            moderator_count: 0,
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        notifications_muted: bool,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else if let Some(limit) = self.user_limit_reached() {
            AddResult::UserLimitReached(limit)
        } else {
            match self.members.entry(user_id) {
                Vacant(e) => {
                    let member = GroupMemberInternal {
                        user_id,
                        date_added: now,
                        role: GroupRoleInternal::Member,
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        mentions_v2: Mentions::default(),
                        threads: HashSet::new(),
                        proposal_votes: BTreeMap::default(),
                        suspended: Timestamped::default(),
                    };
                    e.insert(member.clone());
                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn remove(&mut self, user_id: UserId) -> Option<GroupMemberInternal> {
        if let Some(member) = self.members.remove(&user_id) {
            match member.role {
                GroupRoleInternal::Owner => self.owner_count -= 1,
                GroupRoleInternal::Admin => self.admin_count -= 1,
                GroupRoleInternal::Moderator => self.moderator_count -= 1,
                _ => (),
            }

            Some(member)
        } else {
            None
        }
    }

    pub fn try_undo_remove(&mut self, member: GroupMemberInternal) {
        let user_id = member.user_id;
        let role = member.role;
        if let Vacant(e) = self.members.entry(user_id) {
            e.insert(member);
            match role {
                GroupRoleInternal::Owner => self.owner_count += 1,
                GroupRoleInternal::Admin => self.admin_count += 1,
                GroupRoleInternal::Moderator => self.moderator_count += 1,
                _ => (),
            }
        }
    }

    pub fn block(&mut self, user_id: UserId) {
        self.blocked.insert(user_id);
    }

    pub fn unblock(&mut self, user_id: &UserId) -> bool {
        self.blocked.remove(user_id)
    }

    pub fn blocked(&self) -> Vec<UserId> {
        self.blocked.iter().copied().collect()
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupMemberInternal> {
        self.members.values()
    }

    pub fn get(&self, user_id: &UserId) -> Option<&GroupMemberInternal> {
        self.members.get(user_id)
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.members.contains_key(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut GroupMemberInternal> {
        self.members.get_mut(user_id)
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
    }

    pub fn users_to_notify(&self, thread_participants: Option<Vec<UserId>>) -> HashSet<UserId> {
        if let Some(thread_participants) = thread_participants {
            thread_participants
                .iter()
                .filter(|user_id| {
                    self.get(user_id)
                        .map_or(false, |p| !p.notifications_muted.value && !p.suspended.value)
                })
                .copied()
                .collect()
        } else {
            self.members
                .values()
                .filter(|p| !p.notifications_muted.value)
                .map(|p| p.user_id)
                .collect()
        }
    }

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.members.len() >= MAX_MEMBERS_PER_GROUP as usize {
            Some(MAX_MEMBERS_PER_GROUP)
        } else {
            None
        }
    }

    pub fn len(&self) -> u32 {
        self.members.len() as u32
    }

    pub fn is_empty(&self) -> bool {
        self.members.is_empty()
    }

    pub fn change_role(
        &mut self,
        caller_id: UserId,
        user_id: UserId,
        new_role: GroupRoleInternal,
        permissions: &GroupPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get(&caller_id) {
            Some(p) => {
                if p.suspended.value {
                    return ChangeRoleResult::UserSuspended;
                }
                // Platform moderators can always promote themselves to owner
                if !(p.role.can_change_roles(new_role, permissions) || (is_caller_platform_moderator && new_role.is_owner())) {
                    return ChangeRoleResult::NotAuthorized;
                }
            }
            None => return ChangeRoleResult::UserNotInGroup,
        }

        let mut owner_count = self.owner_count;
        let mut admin_count = self.admin_count;
        let mut moderator_count = self.moderator_count;

        let member = match self.get_mut(&user_id) {
            Some(p) => p,
            None => return ChangeRoleResult::TargetUserNotInGroup,
        };

        // Platform moderators cannot be demoted from owner except by themselves
        if is_user_platform_moderator && member.role.is_owner() && user_id != caller_id {
            return ChangeRoleResult::NotAuthorized;
        }

        // It is not possible to change the role of the last owner
        if member.role.is_owner() && owner_count <= 1 {
            return ChangeRoleResult::Invalid;
        }

        let prev_role = member.role;

        if prev_role == new_role {
            return ChangeRoleResult::Unchanged;
        }

        match member.role {
            GroupRoleInternal::Owner => owner_count -= 1,
            GroupRoleInternal::Admin => admin_count -= 1,
            GroupRoleInternal::Moderator => moderator_count -= 1,
            _ => (),
        }

        member.role = new_role;

        match member.role {
            GroupRoleInternal::Owner => owner_count += 1,
            GroupRoleInternal::Admin => admin_count += 1,
            GroupRoleInternal::Moderator => moderator_count += 1,
            _ => (),
        }

        self.owner_count = owner_count;
        self.admin_count = admin_count;
        self.moderator_count = moderator_count;

        ChangeRoleResult::Success(ChangeRoleSuccess { prev_role })
    }

    pub fn owner_count(&self) -> u32 {
        self.owner_count
    }

    pub fn admin_count(&self) -> u32 {
        self.admin_count
    }

    pub fn moderator_count(&self) -> u32 {
        self.moderator_count
    }

    pub fn add_thread(&mut self, user_id: &UserId, root_message_index: MessageIndex) {
        if let Some(p) = self.get_mut(user_id) {
            p.threads.insert(root_message_index);
        }
    }
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(GroupMemberInternal),
    AlreadyInGroup,
    UserLimitReached(u32),
    Blocked,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccess),
    UserNotInGroup,
    NotAuthorized,
    TargetUserNotInGroup,
    Unchanged,
    Invalid,
    UserSuspended,
}

pub struct ChangeRoleSuccess {
    pub prev_role: GroupRoleInternal,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupMemberInternal {
    #[serde(rename = "u", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "d", alias = "date_added")]
    pub date_added: TimestampMillis,
    #[serde(rename = "r", alias = "role", default, skip_serializing_if = "is_default")]
    pub role: GroupRoleInternal,
    #[serde(rename = "n", alias = "notifications_muted")]
    pub notifications_muted: Timestamped<bool>,
    #[serde(rename = "m", alias = "mentions_v2", default, skip_serializing_if = "mentions_are_empty")]
    pub mentions_v2: Mentions,
    #[serde(rename = "t", alias = "threads", default, skip_serializing_if = "is_empty_hashset")]
    pub threads: HashSet<MessageIndex>,
    #[serde(rename = "p", alias = "proposal_votes", default, skip_serializing_if = "is_empty_btreemap")]
    pub proposal_votes: BTreeMap<TimestampMillis, Vec<MessageIndex>>,
    #[serde(rename = "s", alias = "suspended", default, skip_serializing_if = "is_default")]
    pub suspended: Timestamped<bool>,

    #[serde(
        rename = "me",
        alias = "min_visible_event_index",
        default,
        skip_serializing_if = "is_default"
    )]
    min_visible_event_index: EventIndex,
    #[serde(
        rename = "mm",
        alias = "min_visible_message_index",
        default,
        skip_serializing_if = "is_default"
    )]
    min_visible_message_index: MessageIndex,
}

impl GroupMemberInternal {
    pub fn min_visible_event_index(&self) -> EventIndex {
        if self.role.can_view_full_message_history() {
            EventIndex::default()
        } else {
            self.min_visible_event_index
        }
    }

    pub fn min_visible_message_index(&self) -> MessageIndex {
        if self.role.can_view_full_message_history() {
            MessageIndex::default()
        } else {
            self.min_visible_message_index
        }
    }

    pub fn most_recent_mentions(
        &self,
        since: Option<TimestampMillis>,
        chat_events: &ChatEvents,
        now: TimestampMillis,
    ) -> Vec<Mention> {
        let min_visible_event_index = self.min_visible_event_index();

        self.mentions_v2
            .iter_most_recent(since)
            .filter_map(|m| chat_events.hydrate_mention(min_visible_event_index, m, now))
            .take(MAX_RETURNED_MENTIONS)
            .collect()
    }
}

impl From<GroupMemberInternal> for GroupMember {
    fn from(p: GroupMemberInternal) -> Self {
        GroupMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role.into(),
        }
    }
}

impl From<&GroupMemberInternal> for GroupMember {
    fn from(p: &GroupMemberInternal) -> Self {
        GroupMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role.into(),
        }
    }
}

fn mentions_are_empty(value: &Mentions) -> bool {
    value.is_empty()
}

fn serialize_members<S: Serializer>(value: &HashMap<UserId, GroupMemberInternal>, serializer: S) -> Result<S::Ok, S::Error> {
    let mut seq = serializer.serialize_seq(Some(value.len()))?;
    for member in value.values() {
        seq.serialize_element(member)?;
    }
    seq.end()
}

fn deserialize_members<'de, D: Deserializer<'de>>(deserializer: D) -> Result<HashMap<UserId, GroupMemberInternal>, D::Error> {
    // TODO switch to new impl after next upgrade
    HashMap::deserialize(deserializer)
    // deserializer.deserialize_seq(GroupMembersMapVisitor)
}

struct GroupMembersMapVisitor;

impl<'de> Visitor<'de> for GroupMembersMapVisitor {
    type Value = HashMap<UserId, GroupMemberInternal>;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a sequence")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut map = seq.size_hint().map_or_else(HashMap::new, HashMap::with_capacity);
        while let Some(next) = seq.next_element::<GroupMemberInternal>()? {
            map.insert(next.user_id, next);
        }
        Ok(map)
    }
}

#[cfg(test)]
mod tests {
    use crate::roles::GroupRoleInternal;
    use crate::{GroupMemberInternal, Mentions};
    use candid::Principal;
    use std::collections::{BTreeMap, HashSet};
    use types::{MentionInternal, Timestamped};

    #[test]
    fn serialize_with_max_defaults() {
        let member = GroupMemberInternal {
            user_id: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            date_added: 1,
            role: GroupRoleInternal::Member,
            notifications_muted: Timestamped::new(true, 1),
            mentions_v2: Mentions::default(),
            threads: HashSet::new(),
            proposal_votes: BTreeMap::new(),
            suspended: Timestamped::default(),
            min_visible_event_index: 0.into(),
            min_visible_message_index: 0.into(),
        };

        let member_bytes = msgpack::serialize_then_unwrap(&member);
        let member_bytes_len = member_bytes.len();

        // Before optimisation: 232
        // After optimisation: 27
        assert_eq!(member_bytes_len, 27);

        let _deserialized: GroupMemberInternal = msgpack::deserialize_then_unwrap(&member_bytes);
    }

    #[test]
    fn serialize_with_no_defaults() {
        let mut mentions = Mentions::default();
        mentions.add(
            MentionInternal {
                thread_root_message_index: Some(1.into()),
                message_index: 1.into(),
            },
            1,
        );

        let member = GroupMemberInternal {
            user_id: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            date_added: 1,
            role: GroupRoleInternal::Owner,
            notifications_muted: Timestamped::new(true, 1),
            mentions_v2: mentions,
            threads: HashSet::from([1.into()]),
            proposal_votes: BTreeMap::from([(1, vec![1.into()])]),
            suspended: Timestamped::new(true, 1),
            min_visible_event_index: 1.into(),
            min_visible_message_index: 1.into(),
        };

        let member_bytes = msgpack::serialize_then_unwrap(&member);
        let member_bytes_len = member_bytes.len();

        // Before optimisation: 278
        // After optimisation: 133
        assert_eq!(member_bytes_len, 133);

        let _deserialized: GroupMemberInternal = msgpack::deserialize_then_unwrap(&member_bytes);
    }
}
