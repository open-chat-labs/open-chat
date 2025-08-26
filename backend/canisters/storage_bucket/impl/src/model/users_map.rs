use crate::model::users::UserRecord;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{LazyValue, PrincipalKeyPrefix, StableMemoryMap};

#[derive(Serialize, Deserialize)]
pub struct UsersMap {
    prefix: PrincipalKeyPrefix,
    len: usize,
}

impl StableMemoryMap<PrincipalKeyPrefix, UserRecord> for UsersMap {
    fn prefix(&self) -> &PrincipalKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: UserRecord) -> Vec<u8> {
        user_record_to_bytes(value)
    }

    fn bytes_to_value(_key: &Principal, bytes: Vec<u8>) -> UserRecord {
        bytes_to_user_record(bytes)
    }

    fn on_inserted(&mut self, _key: &Principal, existing: &Option<LazyValue<Principal, UserRecord>>) {
        if existing.is_none() {
            self.len = self.len.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &Principal, _removed: &LazyValue<Principal, UserRecord>) {
        self.len = self.len.saturating_sub(1);
    }
}

impl UsersMap {
    pub fn len(&self) -> usize {
        self.len
    }
}

impl Default for UsersMap {
    fn default() -> Self {
        UsersMap {
            prefix: PrincipalKeyPrefix::new_for_storage_record(),
            len: 0,
        }
    }
}

fn user_record_to_bytes(user_record: UserRecord) -> Vec<u8> {
    msgpack::serialize_then_unwrap(user_record)
}

fn bytes_to_user_record(bytes: Vec<u8>) -> UserRecord {
    msgpack::deserialize_then_unwrap(&bytes)
}
