use crate::GroupMemberInternal;
use serde::de::{SeqAccess, Visitor};
use serde::ser::SerializeSeq;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::BTreeMap;
use std::fmt::Formatter;
use types::UserId;

pub trait MembersMap {
    fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal>;
    fn insert(&mut self, member: GroupMemberInternal);
    fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal>;
}

pub struct HeapMembersMap {
    map: BTreeMap<UserId, GroupMemberInternal>,
}

impl HeapMembersMap {
    pub fn new(member: GroupMemberInternal) -> Self {
        HeapMembersMap {
            map: [(member.user_id(), member)].into_iter().collect(),
        }
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

impl MembersMap for HeapMembersMap {
    fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.get(user_id).cloned()
    }

    fn insert(&mut self, member: GroupMemberInternal) {
        self.map.insert(member.user_id(), member);
    }

    fn remove(&mut self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.map.remove(user_id)
    }
}

impl Serialize for HeapMembersMap {
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

impl<'de> Deserialize<'de> for HeapMembersMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_seq(GroupMembersMapVisitor)
    }
}

struct GroupMembersMapVisitor;

impl<'de> Visitor<'de> for GroupMembersMapVisitor {
    type Value = HeapMembersMap;

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
        Ok(HeapMembersMap { map })
    }
}
