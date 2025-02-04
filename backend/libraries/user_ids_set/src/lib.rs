use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, KeyPrefix, LazyValue, StableMemoryMap, UserIdsKeyPrefix};
use types::UserId;

#[derive(Serialize, Deserialize)]
pub struct UserIdsSet {
    prefix: UserIdsKeyPrefix,
    len: u32,
}

impl StableMemoryMap<UserIdsKeyPrefix, ()> for UserIdsSet {
    fn prefix(&self) -> &UserIdsKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(_value: ()) -> Vec<u8> {
        Vec::new()
    }

    fn bytes_to_value(_key: &(UserId, UserId), _bytes: Vec<u8>) {}

    fn on_inserted(&mut self, _key: &(UserId, UserId), existing: &Option<LazyValue<(UserId, UserId), ()>>) {
        if existing.is_none() {
            self.len = self.len.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &(UserId, UserId), _removed: &LazyValue<(UserId, UserId), ()>) {
        self.len = self.len.saturating_sub(1);
    }
}

impl UserIdsSet {
    pub fn new(prefix: UserIdsKeyPrefix) -> Self {
        Self { prefix, len: 0 }
    }

    pub fn len(&self) -> u32 {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn all_linked_users<I: FromIterator<UserId>>(&self, user_id1: UserId) -> I {
        with_map(|m| {
            m.range(self.prefix.create_key(&(user_id1, Principal::from_slice(&[]).into()))..)
                .take_while(|(key, _)| key.user_ids().0 == user_id1)
                .map(|(key, _)| key.user_ids().1)
                .collect()
        })
    }
}
