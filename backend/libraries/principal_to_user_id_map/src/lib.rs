use ic_principal::Principal;
use serde::de::MapAccess;
use serde::{Deserialize, Deserializer, Serialize};
use stable_memory_map::{with_map, with_map_mut, KeyPrefix, PrincipalToUserIdKeyPrefix};
use std::fmt::Formatter;
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct PrincipalToUserIdMap {
    prefix: PrincipalToUserIdKeyPrefix,
    count: u32,
}

impl PrincipalToUserIdMap {
    pub fn get(&self, principal: &Principal) -> Option<UserId> {
        with_map(|m| m.get(self.prefix.create_key(principal)).map(bytes_to_user_id))
    }

    pub fn insert(&mut self, principal: Principal, user_id: UserId) {
        if with_map_mut(|m| m.insert(self.prefix.create_key(&principal), user_id.as_slice().to_vec())).is_none() {
            self.count += 1;
        }
    }

    pub fn remove(&mut self, principal: &Principal) -> Option<UserId> {
        let bytes = with_map_mut(|m| m.remove(self.prefix.create_key(principal)))?;
        self.count = self.count.saturating_sub(1);
        Some(bytes_to_user_id(bytes))
    }

    pub fn len(&self) -> u32 {
        self.count
    }

    pub fn is_empty(&self) -> bool {
        self.count == 0
    }
}

pub fn deserialize_principal_to_user_id_map_from_heap<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<PrincipalToUserIdMap, D::Error> {
    d.deserialize_map(Visitor)
}

struct Visitor;

impl<'a> serde::de::Visitor<'a> for Visitor {
    type Value = PrincipalToUserIdMap;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a map of (Principal, UserId)")
    }

    fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'a>,
    {
        let mut result = PrincipalToUserIdMap::default();
        while let Some((principal, user_id)) = map.next_entry()? {
            result.insert(principal, user_id);
        }
        Ok(result)
    }
}

fn bytes_to_user_id(bytes: Vec<u8>) -> UserId {
    UserId::from(Principal::from_slice(&bytes))
}
