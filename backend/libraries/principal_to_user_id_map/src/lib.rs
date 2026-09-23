use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, LazyValue, PrincipalKeyPrefix, StableMemoryMap, with_map};
use types::UserId;

#[derive(Serialize, Deserialize)]
pub struct PrincipalToUserIdMap {
    prefix: PrincipalKeyPrefix,
    count: u32,
}

impl StableMemoryMap<PrincipalKeyPrefix, UserId> for PrincipalToUserIdMap {
    fn prefix(&self) -> &PrincipalKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: UserId) -> Vec<u8> {
        value.as_slice().to_vec()
    }

    fn bytes_to_value(_key: &Principal, bytes: Vec<u8>) -> UserId {
        UserId::from(Principal::from_slice(&bytes))
    }

    fn on_inserted(&mut self, _key: &Principal, existing: &Option<LazyValue<Principal, UserId>>) {
        if existing.is_none() {
            self.count = self.count.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &Principal, _removed: &LazyValue<Principal, UserId>) {
        self.count = self.count.saturating_sub(1);
    }
}

impl PrincipalToUserIdMap {
    pub fn len(&self) -> u32 {
        self.count
    }

    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    pub fn entries(&self) -> Vec<(Principal, UserId)> {
        with_map(|m| {
            m.range(self.prefix.create_key(&Principal::from_slice(&[]))..)
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .map(|(k, v)| {
                    let principal = k.principal();
                    let user_id = Self::bytes_to_value(&principal, v);
                    (principal, user_id)
                })
                .collect()
        })
    }
}

impl Default for PrincipalToUserIdMap {
    fn default() -> Self {
        PrincipalToUserIdMap {
            prefix: PrincipalKeyPrefix::new_for_principal_to_user_id_map(),
            count: 0,
        }
    }
}
