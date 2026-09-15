use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, ReferralKey, ReferralKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::RangeInclusive;
use types::{ReferralStatus, TimestampMillis, Timestamped, UserId};
use user_canister::Referral;

// The users the user has referred, stored in the stable memory map for small entries keyed by
// user id, each value holding the referral's status and when it was last updated
#[derive(Serialize, Deserialize, Default)]
pub struct Referrals {
    // The referrals which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "users", default, skip_serializing)]
    on_heap: HashMap<UserId, Timestamped<ReferralStatus>>,
    #[serde(default)]
    last_updated: TimestampMillis,
}

impl Referrals {
    pub fn set_status(&mut self, user_id: UserId, status: ReferralStatus, now: TimestampMillis) -> u32 {
        let key = ReferralKeyPrefix::new().create_key(&user_id);
        let current_status = with_map(|m| m.get(key.clone())).map(|bytes| value_from_bytes(&bytes).value);

        let current_chit_reward = current_status.map(|s| s.chit_reward()).unwrap_or_default();
        let chit_reward_diff = status.chit_reward().saturating_sub(current_chit_reward);

        if chit_reward_diff > 0 || current_status.is_none() {
            with_map_mut(|m| m.insert(key, value_to_bytes(status, now)));
            self.last_updated = self.last_updated.max(now);
        }

        chit_reward_diff
    }

    pub fn list(&self) -> Vec<Referral> {
        self.referrals_updated_since(None)
    }

    pub fn total_verified(&self) -> usize {
        with_map(|m| {
            m.range(all_keys())
                .filter(|(_, bytes)| !matches!(value_from_bytes(bytes).value, ReferralStatus::Registered))
                .count()
        })
    }

    pub fn updated_since(&self, since: TimestampMillis) -> Vec<Referral> {
        if self.last_updated <= since {
            return Vec::new();
        }
        self.referrals_updated_since(Some(since))
    }

    // Moves the referrals which were held on the heap into stable memory, returning how many were
    // moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = ReferralKeyPrefix::new();
        let mut entries: Vec<_> = std::mem::take(&mut self.on_heap)
            .into_iter()
            .map(|(user_id, status)| {
                self.last_updated = self.last_updated.max(status.timestamp);
                (prefix.create_key(&user_id), value_to_bytes(status.value, status.timestamp))
            })
            .collect();
        // Insert the entries in key order
        entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        let count = entries.len();
        with_map_mut(|m| m.insert_many(entries));
        count
    }

    fn referrals_updated_since(&self, since: Option<TimestampMillis>) -> Vec<Referral> {
        with_map(|m| {
            m.range(all_keys())
                .filter_map(|(key, bytes)| {
                    let status = value_from_bytes(&bytes);
                    since.is_none_or(|s| status.timestamp > s).then(|| Referral {
                        user_id: key.user_id(),
                        status: status.value,
                    })
                })
                .collect()
        })
    }
}

fn all_keys() -> RangeInclusive<ReferralKey> {
    // User ids are at most 29 bytes
    let prefix = ReferralKeyPrefix::new();
    prefix.create_key(&UserId::new(Principal::from_slice(&[])))
        ..=prefix.create_key(&UserId::new(Principal::from_slice(&[u8::MAX; 29])))
}

// Status           1 byte
// Last updated     8 bytes
fn value_to_bytes(status: ReferralStatus, last_updated: TimestampMillis) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(9);
    bytes.push(status_to_u8(status));
    bytes.extend_from_slice(&last_updated.to_be_bytes());
    bytes
}

fn value_from_bytes(bytes: &[u8]) -> Timestamped<ReferralStatus> {
    Timestamped::new(status_from_u8(bytes[0]), u64::from_be_bytes(bytes[1..9].try_into().unwrap()))
}

// These values are stored in stable memory, so must never change
fn status_to_u8(status: ReferralStatus) -> u8 {
    match status {
        ReferralStatus::Registered => 0,
        ReferralStatus::Diamond => 1,
        ReferralStatus::UniquePerson => 2,
        ReferralStatus::LifetimeDiamond => 3,
    }
}

fn status_from_u8(value: u8) -> ReferralStatus {
    match value {
        1 => ReferralStatus::Diamond,
        2 => ReferralStatus::UniquePerson,
        3 => ReferralStatus::LifetimeDiamond,
        _ => ReferralStatus::Registered,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::Achievement;

    #[test]
    fn statuses_only_move_to_higher_rewards() {
        init_stable_memory_map();
        let mut referrals = Referrals::default();
        let (user1, user2) = (user_id(1), user_id(2));

        assert_eq!(referrals.set_status(user1, ReferralStatus::Registered, 10), 0);
        assert_eq!(referrals.set_status(user2, ReferralStatus::Registered, 11), 0);
        assert_eq!(referrals.total_verified(), 0);

        let diamond_reward = Achievement::UpgradedToDiamond.chit_reward();
        assert_eq!(referrals.set_status(user1, ReferralStatus::Diamond, 20), diamond_reward);
        // Setting the same status again gives no further reward and doesn't update the referral
        assert_eq!(referrals.set_status(user1, ReferralStatus::Diamond, 30), 0);
        assert_eq!(referrals.set_status(user1, ReferralStatus::Registered, 30), 0);
        assert_eq!(referrals.total_verified(), 1);

        let mut list = referrals.list();
        list.sort_by_key(|r| r.user_id);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].user_id, user1);
        assert!(matches!(list[0].status, ReferralStatus::Diamond));
        assert!(matches!(list[1].status, ReferralStatus::Registered));

        let updated = referrals.updated_since(11);
        assert_eq!(updated.len(), 1);
        assert_eq!(updated[0].user_id, user1);
        assert!(referrals.updated_since(20).is_empty());
    }

    #[test]
    fn referrals_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let statuses = [
            ReferralStatus::Registered,
            ReferralStatus::Diamond,
            ReferralStatus::UniquePerson,
            ReferralStatus::LifetimeDiamond,
        ];
        let mut referrals = Referrals {
            on_heap: (1..=20u8)
                .map(|i| (user_id(i), Timestamped::new(statuses[i as usize % 4], i as u64)))
                .collect(),
            last_updated: 0,
        };

        assert_eq!(referrals.migrate_to_stable_memory(), 20);
        assert!(referrals.on_heap.is_empty());
        assert_eq!(referrals.migrate_to_stable_memory(), 0);

        let list = referrals.list();
        assert_eq!(list.len(), 20);
        for referral in list {
            let i = (1..=20u8).find(|i| user_id(*i) == referral.user_id).unwrap();
            assert_eq!(status_to_u8(referral.status), status_to_u8(statuses[i as usize % 4]));
        }
        assert_eq!(referrals.total_verified(), 15);
        assert_eq!(referrals.updated_since(17).len(), 3);
        assert!(referrals.updated_since(20).is_empty());

        // The heap isn't serialized
        let deserialized: Referrals = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&referrals));
        assert_eq!(deserialized.updated_since(17).len(), 3);
    }

    #[test]
    fn status_bytes_round_trip() {
        for status in [
            ReferralStatus::Registered,
            ReferralStatus::Diamond,
            ReferralStatus::UniquePerson,
            ReferralStatus::LifetimeDiamond,
        ] {
            let value = value_from_bytes(&value_to_bytes(status, 123));
            assert_eq!(status_to_u8(value.value), status_to_u8(status));
            assert_eq!(value.timestamp, 123);
        }
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
