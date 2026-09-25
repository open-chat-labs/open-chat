use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, P2PSwapKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use types::{P2PSwapLocation, TimestampMillis, TokenInfo, UserId};
use user_canister::P2PSwapCreated;

// The P2P swaps the user has created or accepted, stored in the main stable memory map keyed by
// swap id
#[derive(Serialize, Deserialize, Default)]
pub struct P2PSwaps {
    // The swaps which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "swaps", default, skip_serializing)]
    on_heap: HashMap<u32, P2PSwap>,
    #[serde(default)]
    count: u32,
}

impl P2PSwaps {
    pub fn add(&mut self, swap: P2PSwap) {
        let key = P2PSwapKeyPrefix::new().create_key(&swap.id);
        if with_map_mut(|m| m.insert(key, swap_to_bytes(&swap))).is_some() {
            unreachable!()
        }
        self.count += 1;
    }

    // Records a swap the user created directly in a group or community, which it told them of. It is
    // ignored if already recorded, in case they are told of it more than once.
    pub fn add_created_in_chat(&mut self, swap: P2PSwapCreated, created_by: UserId) {
        if with_map(|m| m.get(P2PSwapKeyPrefix::new().create_key(&swap.swap_id))).is_some() {
            return;
        }
        self.add(P2PSwap {
            id: swap.swap_id,
            location: swap.location,
            created_by,
            created: swap.created,
            token0: swap.token0,
            token0_amount: swap.token0_amount,
            token1: swap.token1,
            token1_amount: swap.token1_amount,
            expires_at: swap.expires_at,
        });
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn len(&self) -> usize {
        self.count as usize
    }

    // Moves the swaps which were held on the heap into stable memory, returning how many were moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = P2PSwapKeyPrefix::new();
        let mut entries: Vec<_> = std::mem::take(&mut self.on_heap)
            .into_iter()
            .map(|(swap_id, swap)| (prefix.create_key(&swap_id), swap_to_bytes(&swap)))
            .collect();
        // Insert the entries in key order
        entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        let count = entries.len();
        with_map_mut(|m| m.insert_many(entries));
        self.count += count as u32;
        count
    }
}

fn swap_to_bytes(swap: &P2PSwap) -> Vec<u8> {
    msgpack::serialize_then_unwrap(swap)
}

#[derive(Serialize, Deserialize)]
pub struct P2PSwap {
    pub id: u32,
    pub location: P2PSwapLocation,
    pub created_by: UserId,
    pub created: TimestampMillis,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::P2PSwapKey;
    use types::{Chat, MessageId};

    #[test]
    fn swaps_are_added_to_stable_memory() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();

        for id in [3, 1, 2] {
            swaps.add(swap(id));
        }

        assert_eq!(swaps.len(), 3);
        assert_eq!(stored_ids(), vec![1, 2, 3]);
        let stored: P2PSwap =
            msgpack::deserialize_then_unwrap(&with_map(|m| m.get(P2PSwapKeyPrefix::new().create_key(&2))).unwrap());
        assert_eq!(stored.token0_amount, 200);
        assert!(matches!(stored.location, P2PSwapLocation::Message(_)));
    }

    #[test]
    fn swap_created_in_chat_is_added_once() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();
        let created_by: UserId = Principal::from_slice(&[5; 10]).into();

        for _ in 0..2 {
            swaps.add_created_in_chat(swap_created(4), created_by);
        }

        assert_eq!(swaps.len(), 1);
        let stored: P2PSwap =
            msgpack::deserialize_then_unwrap(&with_map(|m| m.get(P2PSwapKeyPrefix::new().create_key(&4))).unwrap());
        assert_eq!(stored.created_by, created_by);
        assert_eq!(stored.token0_amount, 400);
    }

    #[test]
    #[should_panic]
    fn adding_a_duplicate_swap_panics() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();
        swaps.add(swap(1));
        swaps.add(swap(1));
    }

    #[test]
    fn swaps_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps {
            on_heap: (1..=50).map(|id| (id, swap(id))).collect(),
            count: 0,
        };

        assert_eq!(swaps.migrate_to_stable_memory(), 50);
        assert!(swaps.on_heap.is_empty());
        assert_eq!(swaps.migrate_to_stable_memory(), 0);

        assert_eq!(swaps.len(), 50);
        assert_eq!(stored_ids(), (1..=50).collect::<Vec<_>>());

        swaps.add(swap(51));
        assert_eq!(swaps.len(), 51);

        // The heap isn't serialized
        let deserialized: P2PSwaps = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&swaps));
        assert_eq!(deserialized.len(), 51);
    }

    #[test]
    fn swaps_serialized_before_the_migration_are_migrated_to_stable_memory() {
        // The format `P2PSwaps` was serialized in before the swaps were moved into stable memory
        #[derive(Serialize)]
        struct LegacyP2PSwaps {
            swaps: HashMap<u32, P2PSwap>,
        }

        init_stable_memory_map();
        let legacy = LegacyP2PSwaps {
            swaps: (1..=5).map(|id| (id, swap(id))).collect(),
        };

        let mut swaps: P2PSwaps = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));

        assert_eq!(swaps.migrate_to_stable_memory(), 5);
        assert_eq!(swaps.len(), 5);
        assert_eq!(stored_ids(), (1..=5).collect::<Vec<_>>());
    }

    fn stored_ids() -> Vec<u32> {
        let prefix = P2PSwapKeyPrefix::new();
        with_map(|m| {
            m.range::<P2PSwapKey, _>(prefix.create_key(&0)..=prefix.create_key(&u32::MAX))
                .map(|(k, _)| k.swap_id())
                .collect()
        })
    }

    fn swap(id: u32) -> P2PSwap {
        let token = |symbol: &str, ledger: u8| TokenInfo {
            symbol: symbol.to_string(),
            ledger: Principal::from_slice(&[ledger; 10]),
            decimals: 8,
            fee: 10_000,
        };
        P2PSwap {
            id,
            location: P2PSwapLocation::from_message(
                Chat::Direct(Principal::from_slice(&[4; 10]).into()),
                None,
                MessageId::from(id as u64),
            ),
            created_by: Principal::from_slice(&[5; 10]).into(),
            created: id as u64,
            token0: token("ICP", 1),
            token0_amount: id as u128 * 100,
            token1: token("CHAT", 2),
            token1_amount: id as u128 * 1000,
            expires_at: id as u64 + 1000,
        }
    }

    fn swap_created(id: u32) -> P2PSwapCreated {
        let swap = swap(id);
        P2PSwapCreated {
            swap_id: swap.id,
            location: swap.location,
            token0: swap.token0,
            token0_amount: swap.token0_amount,
            token1: swap.token1,
            token1_amount: swap.token1_amount,
            expires_at: swap.expires_at,
            created: swap.created,
        }
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
