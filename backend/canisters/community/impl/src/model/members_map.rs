use crate::model::members::CommunityMemberInternal;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::BTreeMap;
use types::UserId;

pub trait MembersMap {
    fn get(&self, user_id: &UserId) -> Option<CommunityMemberInternal>;
    fn insert(&mut self, member: CommunityMemberInternal);
    fn remove(&mut self, user_id: &UserId) -> Option<CommunityMemberInternal>;
    fn contains(&self, user_id: &UserId) -> bool;

    fn update_member<F: FnOnce(&mut CommunityMemberInternal) -> bool>(
        &mut self,
        user_id: &UserId,
        update_fn: F,
    ) -> Option<bool> {
        let mut member = self.get(user_id)?;

        let updated = update_fn(&mut member);
        if updated {
            self.insert(member);
        }
        Some(updated)
    }

    #[cfg(test)]
    fn all_members(&self) -> Vec<CommunityMemberInternal>;
}

pub struct HeapMembersMap {
    map: BTreeMap<UserId, CommunityMemberInternal>,
}

impl HeapMembersMap {
    pub fn new(member: CommunityMemberInternal) -> Self {
        HeapMembersMap {
            map: [(member.user_id, member)].into_iter().collect(),
        }
    }
}

impl MembersMap for HeapMembersMap {
    fn get(&self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.map.get(user_id).cloned()
    }

    fn insert(&mut self, member: CommunityMemberInternal) {
        self.map.insert(member.user_id, member);
    }

    fn remove(&mut self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.map.remove(user_id)
    }

    fn contains(&self, user_id: &UserId) -> bool {
        self.map.contains_key(user_id)
    }

    #[cfg(test)]
    fn all_members(&self) -> Vec<CommunityMemberInternal> {
        self.map.values().cloned().collect()
    }
}

impl Serialize for HeapMembersMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.map.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for HeapMembersMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        BTreeMap::deserialize(deserializer).map(|map| HeapMembersMap { map })
    }
}
