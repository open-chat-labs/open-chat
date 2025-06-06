use constants::HOUR_IN_MS;
use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;

#[derive(Serialize, Deserialize, Default)]
pub struct PublicGroupAndCommunityNames {
    names: CaseInsensitiveHashMap<CanisterId>,
    reserved: CaseInsensitiveHashMap<TimestampMillis>,
}

impl PublicGroupAndCommunityNames {
    pub fn check(&self, name: &str, now: TimestampMillis) -> CheckNameResult {
        if self.is_name_reserved(name, now) {
            return CheckNameResult::Reserved;
        }

        if let Some(canister_id) = self.names.get(name) {
            return CheckNameResult::Taken(*canister_id);
        }

        CheckNameResult::Available
    }

    pub fn is_name_taken(&self, name: &str, now: TimestampMillis) -> bool {
        self.names.contains_key(name) || self.is_name_reserved(name, now)
    }

    pub fn insert(&mut self, name: &str, canister_id: CanisterId) {
        self.unreserve_name(name);
        self.names.insert(name, canister_id);
    }

    // Only removes the entry if both the name and canister_id match
    pub fn remove(&mut self, name: &str, canister_id: CanisterId) -> bool {
        if self.names.get(name).is_some_and(|c| *c == canister_id) {
            self.names.remove(name).is_some()
        } else {
            false
        }
    }

    pub fn rename(&mut self, curr_name: &str, new_name: &str, canister_id: CanisterId) -> bool {
        if self.remove(curr_name, canister_id) {
            self.insert(new_name, canister_id);
            true
        } else {
            false
        }
    }

    pub fn reserve_name(&mut self, name: &str, now: TimestampMillis) -> bool {
        if self.is_name_taken(name, now) {
            false
        } else {
            self.reserved.insert(name, now);
            true
        }
    }

    pub fn unreserve_name(&mut self, name: &str) -> bool {
        self.reserved.remove(name).is_some()
    }

    fn is_name_reserved(&self, name: &str, now: TimestampMillis) -> bool {
        self.reserved.get(name).is_some_and(|ts| *ts > now.saturating_sub(HOUR_IN_MS))
    }
}

pub enum CheckNameResult {
    Available,
    Reserved,
    Taken(CanisterId),
}
