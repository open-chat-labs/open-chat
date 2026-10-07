use constants::P2P_SWAP_MAX_EXPIRY;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, P2PSwapKey, P2PSwapKeyPrefix, with_map, with_map_mut};
use types::{P2PSwapLocation, TimestampMillis, TokenInfo, UserId};
use user_canister::P2PSwapCreated;

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

    // Records that the swap has ended (been cancelled, expired or completed), by bringing its expiry
    // forward to `now` if it was later, so that it only holds up migrating the user for as long after
    // that as `any_expiring_after` allows for its last payment or refund
    pub fn mark_ended(&mut self, swap_id: u32, now: TimestampMillis) {
        let key = P2PSwapKeyPrefix::new().create_key(&swap_id);
        let Some(bytes) = with_map(|m| m.get(key.clone())) else {
            return;
        };
        let mut swap: P2PSwap = msgpack::deserialize_then_unwrap(&bytes);
        if swap.expires_at > now {
            swap.expires_at = now;
            with_map_mut(|m| m.insert(key, swap_to_bytes(&swap)));
        }
    }

    // Whether any of the user's swaps, created or accepted, expires after `time`. Until then the
    // Escrow canister may still pay out or refund to the user's account, since it pays out an
    // accepted swap only once told of the acceptance, which can lag, and refunds one which wasn't
    // accepted once it expires. No swap stays open for longer than `P2P_SWAP_MAX_EXPIRY`, whatever
    // expiry it was created with, since the Escrow canister cancelled those which were open for longer.
    pub fn any_expiring_after(&self, time: TimestampMillis) -> bool {
        let prefix = P2PSwapKeyPrefix::new();
        with_map(|m| {
            m.range::<P2PSwapKey, _>(prefix.create_key(&0)..=prefix.create_key(&u32::MAX))
                .any(|(_, bytes)| {
                    let swap: P2PSwap = msgpack::deserialize_then_unwrap(&bytes);
                    swap.expires_at.min(swap.created + P2P_SWAP_MAX_EXPIRY) > time
                })
        })
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
    fn only_unexpired_swaps_are_found() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();
        assert!(!swaps.any_expiring_after(0));

        // Expiring at 1001 and 1002
        swaps.add(swap(1));
        swaps.add(swap(2));

        assert!(swaps.any_expiring_after(1001));
        assert!(!swaps.any_expiring_after(1002));
    }

    #[test]
    fn swap_counts_as_expired_once_open_for_the_longest_a_swap_may_be() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();

        // Created at 1, with an expiry decades away
        let mut long_swap = swap(1);
        long_swap.expires_at = 10_000 * constants::DAY_IN_MS;
        swaps.add(long_swap);

        assert!(swaps.any_expiring_after(P2P_SWAP_MAX_EXPIRY));
        assert!(!swaps.any_expiring_after(1 + P2P_SWAP_MAX_EXPIRY));
    }

    #[test]
    fn ended_swap_counts_as_expired_from_when_it_ended() {
        init_stable_memory_map();
        let mut swaps = P2PSwaps::default();
        // Created at 1, expiring at 1001
        swaps.add(swap(1));

        swaps.mark_ended(1, 500);
        assert!(swaps.any_expiring_after(499));
        assert!(!swaps.any_expiring_after(500));

        // A swap's expiry is never put back, nor is a swap which isn't recorded added
        swaps.mark_ended(1, 800);
        assert!(!swaps.any_expiring_after(500));
        swaps.mark_ended(2, 800);
        assert_eq!(swaps.len(), 1);
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
