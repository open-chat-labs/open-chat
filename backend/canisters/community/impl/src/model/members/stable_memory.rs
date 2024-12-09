use crate::CommunityMemberInternal;
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{with_map, with_map_mut, KeyPrefix, MemberKeyPrefix};
use std::collections::BTreeSet;
use types::{is_default, CommunityRole, TimestampMillis, Timestamped, UserId, UserType, Version};

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: MemberKeyPrefix,
}

impl MembersStableStorage {
    pub fn new(member: CommunityMemberInternal) -> Self {
        let mut map = MembersStableStorage::default();
        map.insert(member);
        map
    }

    pub fn get(&self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        with_map(|m| {
            m.get(self.prefix.create_key(user_id))
                .map(|v| bytes_to_member(&v).hydrate(*user_id))
        })
    }

    pub fn insert(&mut self, member: CommunityMemberInternal) {
        with_map_mut(|m| m.insert(self.prefix.create_key(&member.user_id), member_to_bytes(member.into())));
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        with_map_mut(|m| {
            m.remove(self.prefix.create_key(user_id))
                .map(|v| bytes_to_member(&v).hydrate(*user_id))
        })
    }

    #[cfg(test)]
    pub fn all_members(&self) -> Vec<CommunityMemberInternal> {
        use candid::Principal;
        use stable_memory_map::Key;

        with_map(|m| {
            m.range(self.prefix.create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .map(|(k, v)| bytes_to_member(&v).hydrate(k.user_id()))
                .collect()
        })
    }
}

impl Default for MembersStableStorage {
    fn default() -> Self {
        MembersStableStorage {
            prefix: MemberKeyPrefix::new_from_community(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMemberStableStorage {
    #[serde(rename = "d", alias = "date_added")]
    date_added: TimestampMillis,
    #[serde(rename = "r", alias = "role", default, skip_serializing_if = "is_default")]
    role: CommunityRole,
    #[serde(rename = "ra", alias = "rules_accepted", skip_serializing_if = "Option::is_none")]
    rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", alias = "user_type", default, skip_serializing_if = "is_default")]
    user_type: UserType,
    #[serde(rename = "dn", alias = "display_name", default, skip_serializing_if = "is_default")]
    display_name: Timestamped<Option<String>>,
    #[serde(rename = "rb", alias = "referred_by", skip_serializing_if = "Option::is_none")]
    referred_by: Option<UserId>,
    #[serde(rename = "rf", alias = "referrals", default, skip_serializing_if = "BTreeSet::is_empty")]
    referrals: BTreeSet<UserId>,
    #[serde(rename = "rr", default, skip_serializing_if = "BTreeSet::is_empty")]
    referrals_removed: BTreeSet<UserId>,
    #[serde(rename = "l", alias = "lapsed", default, skip_serializing_if = "is_default")]
    lapsed: Timestamped<bool>,
    #[serde(rename = "s", alias = "suspended", default, skip_serializing_if = "is_default")]
    suspended: Timestamped<bool>,
}

impl CommunityMemberStableStorage {
    fn hydrate(self, user_id: UserId) -> CommunityMemberInternal {
        CommunityMemberInternal {
            user_id,
            date_added: self.date_added,
            role: self.role,
            rules_accepted: self.rules_accepted,
            user_type: self.user_type,
            display_name: self.display_name,
            referred_by: self.referred_by,
            referrals: self.referrals,
            referrals_removed: self.referrals_removed,
            lapsed: self.lapsed,
            suspended: self.suspended,
        }
    }
}

impl From<CommunityMemberInternal> for CommunityMemberStableStorage {
    fn from(value: CommunityMemberInternal) -> Self {
        CommunityMemberStableStorage {
            date_added: value.date_added,
            role: value.role,
            rules_accepted: value.rules_accepted,
            user_type: value.user_type,
            display_name: value.display_name,
            referred_by: value.referred_by,
            referrals: value.referrals,
            referrals_removed: value.referrals_removed,
            lapsed: value.lapsed,
            suspended: value.suspended,
        }
    }
}

fn member_to_bytes(member: CommunityMemberStableStorage) -> Vec<u8> {
    msgpack::serialize_then_unwrap(member)
}

fn bytes_to_member(bytes: &[u8]) -> CommunityMemberStableStorage {
    msgpack::deserialize_then_unwrap(bytes)
}
