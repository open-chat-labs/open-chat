use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId};

// The users being imported from canisters of their own, keyed by their old id, each of whom has
// been assigned an index. The user is pulled from their canister in pages, followed by their entries
// in the stable memory map, which are inserted under their index as they arrive. Once everything
// has been pulled the user is added at their index.
#[derive(Serialize, Deserialize, Default)]
pub struct UserImports {
    imports: BTreeMap<UserId, UserImport>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserImport {
    pub index: u16,
    pub started: TimestampMillis,
    // The user as serialized by their canister, pulled so far
    #[serde(with = "serde_bytes")]
    pub user: Vec<u8>,
    // Set once all of the user has been pulled and their hash checked
    pub user_pulled: bool,
    // The key of the last entry in the stable memory map pulled
    pub stable_memory_after: Option<ByteBuf>,
    // The number of consecutive attempts to pull the next page which have failed
    pub failed_attempts: u32,
    // After a failed attempt, the next isn't made until this time
    pub retry_after: TimestampMillis,
}

impl UserImports {
    pub fn add(&mut self, user_id: UserId, index: u16, now: TimestampMillis) {
        self.imports.insert(
            user_id,
            UserImport {
                index,
                started: now,
                user: Vec::new(),
                user_pulled: false,
                stable_memory_after: None,
                failed_attempts: 0,
                retry_after: 0,
            },
        );
    }

    pub fn get(&self, user_id: &UserId) -> Option<&UserImport> {
        self.imports.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut UserImport> {
        self.imports.get_mut(user_id)
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<UserImport> {
        self.imports.remove(user_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &UserImport)> {
        self.imports.iter()
    }

    pub fn len(&self) -> usize {
        self.imports.len()
    }
}
