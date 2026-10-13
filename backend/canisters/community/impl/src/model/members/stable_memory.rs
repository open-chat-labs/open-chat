use crate::CommunityMemberInternal;
use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, StableMemoryMap, UserIdKey, UserIdKeyPrefix, with_map, with_map_mut};
use std::collections::BTreeSet;
use std::ops::Bound;
use types::{CommunityRole, TimestampMillis, Timestamped, UserId, UserType, Version, is_default};

#[derive(Serialize, Deserialize)]
pub struct MembersStableStorage {
    prefix: UserIdKeyPrefix,
}

impl StableMemoryMap<UserIdKeyPrefix, CommunityMemberInternal> for MembersStableStorage {
    fn prefix(&self) -> &UserIdKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: CommunityMemberInternal) -> Vec<u8> {
        member_to_bytes(value.into())
    }

    fn bytes_to_value(user_id: &UserId, bytes: Vec<u8>) -> CommunityMemberInternal {
        bytes_to_member(&bytes).hydrate(*user_id)
    }
}

impl MembersStableStorage {
    pub fn new(member: CommunityMemberInternal) -> Self {
        let mut map = MembersStableStorage::default();
        map.insert(member.user_id, member);
        map
    }

    // Passes the ids in the `referred_by` and `referrals` of up to `max_count` members, in key order
    // starting after `after`, through `f`, replacing each with the id returned, and writes back the
    // members changed. Returns the last member passed if there may be more after them, otherwise None.
    // The `referrals_removed` are left as they are, since they are what clients have been told of.
    pub fn update_referral_user_ids(
        &mut self,
        after: Option<UserId>,
        max_count: usize,
        f: &mut dyn FnMut(UserId) -> UserId,
    ) -> Option<UserId> {
        let start = match after {
            Some(user_id) => Bound::Excluded(self.prefix.create_key(&user_id)),
            None => Bound::Included(self.prefix.create_key(&Principal::from_slice(&[]).into())),
        };
        let entries: Vec<(UserIdKey, Vec<u8>)> = with_map(|m| {
            m.range((start, Bound::Unbounded))
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .take(max_count)
                .collect()
        });
        let last = entries
            .last()
            .filter(|_| entries.len() == max_count)
            .map(|(k, _)| k.user_id());

        // The entries are already in key order, so are written back in bulk
        let updated: Vec<_> = entries
            .into_iter()
            .filter_map(|(key, bytes)| {
                let mut member = bytes_to_member(&bytes);
                let referred_by = member.referred_by.map(&mut *f);
                let referrals: BTreeSet<_> = member.referrals.iter().map(|u| f(*u)).collect();
                if referred_by != member.referred_by || referrals != member.referrals {
                    member.referred_by = referred_by;
                    member.referrals = referrals;
                    Some((key, member_to_bytes(member)))
                } else {
                    None
                }
            })
            .collect();
        with_map_mut(|m| m.insert_many(updated));
        last
    }

    // Writes the members together, so that each node of the stable memory map is written once rather
    // than once per member (see `StableMemoryMapInner::insert_many`). Keys are ordered by their bytes
    // whereas user ids are ordered by length first, so the keys are sorted here. A member given more
    // than once is left as last given.
    pub fn insert_many(&mut self, members: impl IntoIterator<Item = CommunityMemberInternal>) {
        let mut entries: Vec<_> = members
            .into_iter()
            .map(|member| (self.prefix.create_key(&member.user_id), member_to_bytes(member.into())))
            .collect();
        entries.sort_by(|(k1, _), (k2, _)| k1.cmp(k2));
        with_map_mut(|m| m.insert_many(entries));
    }

    // The key and value of each member as stored
    #[cfg(test)]
    pub fn all_entries(&self) -> Vec<(Vec<u8>, Vec<u8>)> {
        with_map(|m| {
            m.range(self.prefix.create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .map(|(k, v)| (k.as_ref().to_vec(), v))
                .collect()
        })
    }

    #[cfg(test)]
    pub fn all_members(&self) -> Vec<CommunityMemberInternal> {
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
            prefix: UserIdKeyPrefix::new_from_community(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMemberStableStorage {
    // Members stored before principals were added had theirs set by a one-off backfill, but only
    // where it found the principal, so the default stays until no member is known to lack one
    #[serde(rename = "p", default = "Principal::anonymous")]
    principal: Principal,
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
            principal: self.principal,
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
            principal: value.principal,
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
