use crate::mentions::Mentions;
use crate::roles::GroupRoleInternal;
use crate::AccessRulesInternal;
use chat_events::ChatEvents;
use group_community_common::{Member, Members};
use serde::de::{SeqAccess, Visitor};
use serde::ser::SerializeSeq;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::cmp::max;
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fmt::Formatter;
use types::{
    is_default, EventIndex, GroupMember, GroupPermissions, HydratedMention, MessageIndex, TimestampMillis, Timestamped, UserId,
    UserType, Version, MAX_RETURNED_MENTIONS,
};
use utils::timestamped_set::TimestampedSet;

const MAX_MEMBERS_PER_GROUP: u32 = 100_000;

#[derive(Serialize, Deserialize, Default)]
pub struct GroupMembers {
    #[serde(serialize_with = "serialize_members", deserialize_with = "deserialize_members")]
    pub members: HashMap<UserId, GroupMemberInternal>,
    pub blocked: HashSet<UserId>,
    pub moderator_count: u32,
    pub admin_count: u32,
    pub owner_count: u32,
    updates: BTreeSet<(TimestampMillis, UserId, MemberUpdate)>,
}

#[derive(Serialize_repr, Deserialize_repr, Clone, Copy, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u8)]
pub enum MemberUpdate {
    Added = 1,
    Removed = 2,
    RoleChanged = 3,
    Blocked = 4,
    Unblocked = 5,
    Lapsed = 6,
    Unlapsed = 7,
}

#[allow(clippy::too_many_arguments)]
impl GroupMembers {
    pub fn new(creator_user_id: UserId, user_type: UserType, now: TimestampMillis) -> GroupMembers {
        let member = GroupMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Timestamped::new(GroupRoleInternal::Owner, now),
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: Timestamped::new(false, now),
            mentions: Mentions::default(),
            threads: HashSet::new(),
            followed_threads: TimestampedSet::new(),
            unfollowed_threads: TimestampedSet::new(),
            proposal_votes: BTreeMap::default(),
            suspended: Timestamped::default(),
            rules_accepted: Some(Timestamped::new(Version::zero(), now)),
            user_type,
            lapsed: Timestamped::default(),
        };

        GroupMembers {
            members: vec![(creator_user_id, member)].into_iter().collect(),
            blocked: HashSet::new(),
            moderator_count: 0,
            admin_count: 0,
            owner_count: 1,
            updates: BTreeSet::new(),
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        notifications_muted: bool,
        user_type: UserType,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else if let Some(limit) = self.user_limit_reached() {
            AddResult::MemberLimitReached(limit)
        } else {
            match self.members.entry(user_id) {
                Vacant(e) => {
                    let member = GroupMemberInternal {
                        user_id,
                        date_added: now,
                        role: Timestamped::new(GroupRoleInternal::Member, now),
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        mentions: Mentions::default(),
                        threads: HashSet::new(),
                        followed_threads: TimestampedSet::new(),
                        unfollowed_threads: TimestampedSet::new(),
                        proposal_votes: BTreeMap::default(),
                        suspended: Timestamped::default(),
                        rules_accepted: None,
                        user_type,
                        lapsed: Timestamped::new(false, now),
                    };
                    e.insert(member.clone());
                    self.updates.insert((now, user_id, MemberUpdate::Added));
                    AddResult::Success(AddMemberSuccess { member, unlapse: false })
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn remove(&mut self, user_id: UserId, now: TimestampMillis) -> Option<GroupMemberInternal> {
        if let Some(member) = self.members.remove(&user_id) {
            match member.role.value {
                GroupRoleInternal::Owner => self.owner_count -= 1,
                GroupRoleInternal::Admin => self.admin_count -= 1,
                GroupRoleInternal::Moderator => self.moderator_count -= 1,
                _ => (),
            }

            self.updates.insert((now, user_id, MemberUpdate::Removed));
            Some(member)
        } else {
            None
        }
    }

    pub fn block(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.blocked.insert(user_id) {
            self.updates.insert((now, user_id, MemberUpdate::Blocked));
            true
        } else {
            false
        }
    }

    pub fn unblock(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.blocked.remove(&user_id) {
            self.updates.insert((now, user_id, MemberUpdate::Unblocked));
            true
        } else {
            false
        }
    }

    pub fn blocked(&self) -> Vec<UserId> {
        self.blocked.iter().copied().collect()
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupMemberInternal> {
        self.members.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut GroupMemberInternal> {
        self.members.values_mut()
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
        now: TimestampMillis,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get(&caller_id) {
            Some(p) => {
                if p.suspended.value {
                    return ChangeRoleResult::UserSuspended;
                } else if p.lapsed() {
                    return ChangeRoleResult::UserLapsed;
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

        let prev_role = member.role.value;

        if prev_role == new_role {
            return ChangeRoleResult::Unchanged;
        }

        match prev_role {
            GroupRoleInternal::Owner => owner_count -= 1,
            GroupRoleInternal::Admin => admin_count -= 1,
            GroupRoleInternal::Moderator => moderator_count -= 1,
            _ => (),
        }

        member.role = Timestamped::new(new_role, now);

        match new_role {
            GroupRoleInternal::Owner => owner_count += 1,
            GroupRoleInternal::Admin => admin_count += 1,
            GroupRoleInternal::Moderator => moderator_count += 1,
            _ => (),
        }

        self.owner_count = owner_count;
        self.admin_count = admin_count;
        self.moderator_count = moderator_count;
        self.updates.insert((now, user_id, MemberUpdate::RoleChanged));

        ChangeRoleResult::Success(ChangeRoleSuccess { prev_role })
    }

    pub fn unlapse_all(&mut self, now: TimestampMillis) {
        for m in self.members.values_mut() {
            if m.set_lapsed(false, now) {
                self.updates.insert((now, m.user_id, MemberUpdate::Unlapsed));
            }
        }
    }

    pub fn update_lapsed(&mut self, user_id: UserId, lapse: bool, now: TimestampMillis) {
        let Some(member) = self.get_mut(&user_id) else {
            return;
        };

        let updated = if lapse {
            // Owners can't lapse
            !member.is_owner() && member.set_lapsed(true, now)
        } else {
            member.set_lapsed(false, now)
        };

        if updated {
            self.updates.insert((
                now,
                user_id,
                if lapse { MemberUpdate::Lapsed } else { MemberUpdate::Unlapsed },
            ));
        }
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

    pub fn has_membership_changed(&self, since: TimestampMillis) -> bool {
        self.iter_latest_updates(since)
            .any(|(_, u)| matches!(u, MemberUpdate::Added | MemberUpdate::Removed))
    }

    pub fn iter_latest_updates(&self, since: TimestampMillis) -> impl Iterator<Item = (UserId, MemberUpdate)> + '_ {
        self.updates
            .iter()
            .rev()
            .take_while(move |(ts, _, _)| *ts > since)
            .map(|(_, user_id, update)| (*user_id, *update))
    }

    pub fn last_updated(&self) -> Option<TimestampMillis> {
        self.updates.iter().next_back().map(|(ts, _, _)| *ts)
    }
}

impl Members for GroupMembers {
    type Member = GroupMemberInternal;

    fn get(&self, user_id: &UserId) -> Option<&GroupMemberInternal> {
        self.get(user_id)
    }
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(AddMemberSuccess),
    AlreadyInGroup,
    MemberLimitReached(u32),
    Blocked,
}

pub struct AddMemberSuccess {
    pub member: GroupMemberInternal,
    pub unlapse: bool,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccess),
    UserNotInGroup,
    NotAuthorized,
    TargetUserNotInGroup,
    Unchanged,
    Invalid,
    UserSuspended,
    UserLapsed,
}

pub struct ChangeRoleSuccess {
    pub prev_role: GroupRoleInternal,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupMemberInternal {
    #[serde(rename = "u")]
    pub user_id: UserId,
    #[serde(rename = "d")]
    pub date_added: TimestampMillis,
    #[serde(rename = "r", default, skip_serializing_if = "is_default")]
    pub role: Timestamped<GroupRoleInternal>,
    #[serde(rename = "n")]
    pub notifications_muted: Timestamped<bool>,
    #[serde(rename = "m", default, skip_serializing_if = "mentions_are_empty")]
    pub mentions: Mentions,
    #[serde(rename = "t", default, skip_serializing_if = "HashSet::is_empty")]
    pub threads: HashSet<MessageIndex>,
    #[serde(rename = "ft", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub followed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "ut", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub unfollowed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "p", default, skip_serializing_if = "BTreeMap::is_empty")]
    pub proposal_votes: BTreeMap<TimestampMillis, Vec<MessageIndex>>,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    pub suspended: Timestamped<bool>,
    #[serde(rename = "ra", default, skip_serializing_if = "is_default")]
    pub rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", default, skip_serializing_if = "is_default")]
    pub user_type: UserType,
    #[serde(rename = "me", default, skip_serializing_if = "is_default")]
    min_visible_event_index: EventIndex,
    #[serde(rename = "mm", default, skip_serializing_if = "is_default")]
    min_visible_message_index: MessageIndex,
    #[serde(rename = "la", default, skip_serializing_if = "is_default")]
    pub lapsed: Timestamped<bool>,
}

impl GroupMemberInternal {
    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.date_added,
            self.role.timestamp,
            self.notifications_muted.timestamp,
            self.suspended.timestamp,
            self.rules_accepted.as_ref().map(|r| r.timestamp).unwrap_or_default(),
            self.lapsed.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

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

    pub fn most_recent_mentions(&self, since: Option<TimestampMillis>, chat_events: &ChatEvents) -> Vec<HydratedMention> {
        let min_visible_event_index = self.min_visible_event_index();

        self.mentions
            .iter_most_recent(since)
            .filter_map(|m| chat_events.hydrate_mention(min_visible_event_index, &m))
            .take(MAX_RETURNED_MENTIONS)
            .collect()
    }

    pub fn accept_rules(&mut self, version: Version, now: TimestampMillis) {
        let current_version = self
            .rules_accepted
            .as_ref()
            .map(|accepted| accepted.value)
            .unwrap_or_default();

        self.rules_accepted = Some(Timestamped::new(max(version, current_version), now));
    }

    pub fn check_rules(&self, rules: &AccessRulesInternal) -> bool {
        !rules.enabled
            || self.user_type.is_bot()
            || (self
                .rules_accepted
                .as_ref()
                .map_or(false, |accepted| accepted.value >= rules.text.version))
    }
}

impl Member for GroupMemberInternal {
    fn user_id(&self) -> UserId {
        self.user_id
    }

    fn is_owner(&self) -> bool {
        self.role.is_owner()
    }

    fn lapsed(&self) -> bool {
        self.lapsed.value
    }

    fn set_lapsed(&mut self, lapsed: bool, timestamp: TimestampMillis) -> bool {
        if lapsed != self.lapsed.value {
            self.lapsed = Timestamped::new(lapsed, timestamp);
            true
        } else {
            false
        }
    }
}

impl From<&GroupMemberInternal> for GroupMember {
    fn from(m: &GroupMemberInternal) -> Self {
        GroupMember {
            user_id: m.user_id,
            date_added: m.date_added,
            role: m.role.value.into(),
            lapsed: m.lapsed.value,
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
    deserializer.deserialize_seq(GroupMembersMapVisitor)
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
    use types::{Timestamped, UserType, Version};
    use utils::timestamped_set::TimestampedSet;

    #[test]
    fn serialize_with_max_defaults() {
        let member = GroupMemberInternal {
            user_id: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            date_added: 1,
            role: Timestamped::new(GroupRoleInternal::Member, 0),
            notifications_muted: Timestamped::new(true, 1),
            mentions: Mentions::default(),
            threads: HashSet::new(),
            followed_threads: TimestampedSet::default(),
            unfollowed_threads: TimestampedSet::default(),
            proposal_votes: BTreeMap::new(),
            suspended: Timestamped::default(),
            min_visible_event_index: 0.into(),
            min_visible_message_index: 0.into(),
            rules_accepted: Some(Timestamped::new(Version::zero(), 1)),
            user_type: UserType::User,
            lapsed: Timestamped::default(),
        };

        let member_bytes = msgpack::serialize_then_unwrap(&member);
        let member_bytes_len = member_bytes.len();

        assert_eq!(member_bytes_len, 37);

        let _deserialized: GroupMemberInternal = msgpack::deserialize_then_unwrap(&member_bytes);
    }

    #[test]
    fn serialize_with_no_defaults() {
        let mut mentions = Mentions::default();
        mentions.add(Some(1.into()), 1.into(), 1);

        let member = GroupMemberInternal {
            user_id: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            date_added: 1,
            role: Timestamped::new(GroupRoleInternal::Owner, 1),
            notifications_muted: Timestamped::new(true, 1),
            mentions,
            threads: HashSet::from([1.into()]),
            followed_threads: [(1.into(), 1)].into_iter().collect(),
            unfollowed_threads: [(1.into(), 1)].into_iter().collect(),
            proposal_votes: BTreeMap::from([(1, vec![1.into()])]),
            suspended: Timestamped::new(true, 1),
            min_visible_event_index: 1.into(),
            min_visible_message_index: 1.into(),
            rules_accepted: Some(Timestamped::new(Version::zero(), 1)),
            user_type: UserType::Bot,
            lapsed: Timestamped::new(false, 1),
        };

        let member_bytes = msgpack::serialize_then_unwrap(&member);
        let member_bytes_len = member_bytes.len();

        assert_eq!(member_bytes_len, 134);

        let _deserialized: GroupMemberInternal = msgpack::deserialize_then_unwrap(&member_bytes);
    }
}
