use crate::model::users::UserRecord;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{LazyValue, StableMemoryMap, UserStorageRecordKeyPrefix};

#[derive(Serialize, Deserialize, Default)]
pub struct UsersMap {
    prefix: UserStorageRecordKeyPrefix,
    len: usize,
}

impl StableMemoryMap<UserStorageRecordKeyPrefix, UserRecord> for UsersMap {
    fn prefix(&self) -> &UserStorageRecordKeyPrefix {
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

fn user_record_to_bytes(user_record: UserRecord) -> Vec<u8> {
    msgpack::serialize_then_unwrap(user_record)
}

fn bytes_to_user_record(bytes: Vec<u8>) -> UserRecord {
    msgpack::deserialize_then_unwrap(&bytes)
}
