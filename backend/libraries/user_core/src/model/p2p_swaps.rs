use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, P2PSwapKeyPrefix, with_map_mut};
use types::{P2PSwapLocation, TimestampMillis, TokenInfo, UserId};

// The P2P swaps the user has created or accepted, stored in the main stable memory map keyed by
// swap id
#[derive(Serialize, Deserialize, Default)]
pub struct P2PSwaps {
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

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn len(&self) -> usize {
        self.count as usize
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
    use stable_memory_map::{P2PSwapKey, with_map};
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
    #[should_panic]
    fn adding_a_duplicate_swap_panics() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();
        swaps.add(swap(1));
        swaps.add(swap(1));
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

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
