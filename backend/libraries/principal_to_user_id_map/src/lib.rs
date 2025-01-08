use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{PrincipalToUserIdKeyPrefix, StableMemoryMap};
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct PrincipalToUserIdMap {
    prefix: PrincipalToUserIdKeyPrefix,
    count: u32,
}

impl StableMemoryMap<PrincipalToUserIdKeyPrefix, UserId> for PrincipalToUserIdMap {
    fn prefix(&self) -> &PrincipalToUserIdKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(&self, value: UserId) -> Vec<u8> {
        value.as_slice().to_vec()
    }

    fn bytes_to_value(&self, _key: &Principal, bytes: Vec<u8>) -> UserId {
        UserId::from(Principal::from_slice(&bytes))
    }

    fn on_inserted(&mut self, _key: &Principal, existing: &Option<UserId>) {
        if existing.is_none() {
            self.count = self.count.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &Principal, _removed: &UserId) {
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
}
