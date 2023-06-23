use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;

#[derive(Serialize, Deserialize, Default)]
pub struct PublicGroupAndCommunityNames {
    names: CaseInsensitiveHashMap<CanisterId>,
    reserved: CaseInsensitiveHashMap<TimestampMillis>,
}

impl PublicGroupAndCommunityNames {
    pub fn is_name_taken(&self, name: &str) -> bool {
        self.names.contains_key(name) || self.reserved.contains_key(name)
    }

    pub fn insert(&mut self, name: &str, canister_id: CanisterId) {
        self.unreserve_name(name);
        self.names.insert(name, canister_id);
    }

    // Only removes the entry if both the name and canister_id match
    pub fn remove(&mut self, name: &str, canister_id: CanisterId) -> bool {
        if let Some(c) = self.names.get(name).copied() {
            if c == canister_id {
                return self.names.remove(name).is_some();
            }
        }
        false
    }

    pub fn reserve_name(&mut self, name: &str, now: TimestampMillis) -> bool {
        if self.is_name_taken(name) {
            false
        } else {
            self.reserved.insert(name, now);
            true
        }
    }

    pub fn unreserve_name(&mut self, name: &str) -> bool {
        self.reserved.remove(name).is_some()
    }
}
