use crate::GroupMemberInternal;
use serde::de::{SeqAccess, Visitor};
use serde::ser::SerializeSeq;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::BTreeMap;
use std::fmt::Formatter;
use types::UserId;

pub struct MembersMap {
    map: BTreeMap<UserId, GroupMemberInternal>,
}

impl MembersMap {
    pub fn new(member: GroupMemberInternal) -> Self {
        MembersMap {
            map: [(member.user_id(), member)].into_iter().collect(),
        }
    }

    pub fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.get(user_id).cloned()
    }

    pub fn insert(&mut self, member: GroupMemberInternal) {
        self.map.insert(member.user_id(), member);
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.remove(user_id)
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    // TODO Remove after next upgrade
    pub fn values_mut(&mut self) -> impl Iterator<Item = &mut GroupMemberInternal> + '_ {
        self.map.values_mut()
    }

    #[cfg(test)]
    pub fn values(&self) -> impl Iterator<Item = &GroupMemberInternal> + '_ {
        self.map.values()
    }
}

impl Serialize for MembersMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(self.map.len()))?;
        for member in self.map.values() {
            seq.serialize_element(member)?;
        }
        seq.end()
    }
}

impl<'de> Deserialize<'de> for MembersMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_seq(GroupMembersMapVisitor)
    }
}

struct GroupMembersMapVisitor;

impl<'de> Visitor<'de> for GroupMembersMapVisitor {
    type Value = MembersMap;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a sequence")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut map = BTreeMap::new();
        while let Some(next) = seq.next_element::<GroupMemberInternal>()? {
            map.insert(next.user_id(), next);
        }
        Ok(MembersMap { map })
    }
}
