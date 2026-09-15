use crate::token_swaps::swap_client::SwapSuccess;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, TokenSwapKey, TokenSwapKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::RangeInclusive;
use types::icrc1::Account;
use types::{TimestampMillis, Timestamped};
use user_canister::token_swap_status::TokenSwapStatus;

// The user's token swaps, stored in the main stable memory map keyed by swap id
#[derive(Serialize, Deserialize, Default)]
pub struct TokenSwaps {
    // The swaps which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "swaps", default, skip_serializing)]
    on_heap: HashMap<u128, TokenSwap>,
    #[serde(default)]
    count: u32,
}

impl TokenSwaps {
    pub fn push_new(
        &mut self,
        args: user_canister::swap_tokens::Args,
        icrc2: bool,
        auto_withdrawals: bool,
        now: TimestampMillis,
    ) -> TokenSwap {
        let token_swap = TokenSwap::new(args, icrc2, auto_withdrawals, now);
        self.upsert(token_swap.clone());
        token_swap
    }

    pub fn upsert(&mut self, swap: TokenSwap) {
        let key = TokenSwapKeyPrefix::new().create_key(&swap.args.swap_id);
        if with_map_mut(|m| m.insert(key, swap_to_bytes(&swap))).is_none() {
            self.count += 1;
        }
    }

    pub fn get(&self, swap_id: u128) -> Option<TokenSwap> {
        with_map(|m| m.get(TokenSwapKeyPrefix::new().create_key(&swap_id))).map(|bytes| swap_from_bytes(&bytes))
    }

    // Returns a page of the swaps, ordered by swap id
    pub fn page(&self, start: usize, max_results: usize) -> Vec<TokenSwap> {
        with_map(|m| {
            m.range(all_keys())
                .skip(start)
                .take(max_results)
                .map(|(_, bytes)| swap_from_bytes(&bytes))
                .collect()
        })
    }

    pub fn all(&self) -> Vec<TokenSwap> {
        self.page(0, usize::MAX)
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

        let prefix = TokenSwapKeyPrefix::new();
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

fn all_keys() -> RangeInclusive<TokenSwapKey> {
    let prefix = TokenSwapKeyPrefix::new();
    prefix.create_key(&0)..=prefix.create_key(&u128::MAX)
}

fn swap_to_bytes(swap: &TokenSwap) -> Vec<u8> {
    msgpack::serialize_then_unwrap(swap)
}

fn swap_from_bytes(bytes: &[u8]) -> TokenSwap {
    msgpack::deserialize_then_unwrap(bytes)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TokenSwap {
    pub args: user_canister::swap_tokens::Args,
    pub started: TimestampMillis,
    pub icrc2: bool,
    pub auto_withdrawals: bool,
    pub deposit_account: SwapSubtask<Account>,
    pub transfer_or_approval: SwapSubtask<u64>, // Block Index
    pub notified_dex_at: SwapSubtask,
    pub swap_result: SwapSubtask<Result<SwapSuccess, String>>,
    pub withdrawn_from_dex_at: SwapSubtask<u128>,
    pub success: Option<Timestamped<bool>>,
}

type SwapSubtask<T = ()> = Option<Timestamped<Result<T, String>>>;

impl TokenSwap {
    pub fn new(args: user_canister::swap_tokens::Args, icrc2: bool, auto_withdrawals: bool, now: TimestampMillis) -> TokenSwap {
        TokenSwap {
            args,
            started: now,
            icrc2,
            auto_withdrawals,
            deposit_account: None,
            transfer_or_approval: None,
            notified_dex_at: None,
            swap_result: None,
            withdrawn_from_dex_at: None,
            success: None,
        }
    }
}

impl From<TokenSwap> for TokenSwapStatus {
    fn from(value: TokenSwap) -> Self {
        TokenSwapStatus {
            started: value.started,
            icrc2: value.icrc2,
            auto_withdrawals: value.auto_withdrawals,
            deposit_account: value.deposit_account.map(|a| a.value.map(|_| ())),
            transfer: value.transfer_or_approval.clone().map(|t| t.value),
            transfer_or_approval: value.transfer_or_approval.map(|t| t.value),
            notify_dex: value.notified_dex_at.map(|t| t.value.map(|_| ())),
            amount_swapped: value
                .swap_result
                .as_ref()
                .map(|t| t.value.clone().map(|r| r.map(|a| a.amount_out))),
            withdraw_from_dex: value.withdrawn_from_dex_at.map(|t| t.value),
            success: value.success.map(|t| t.value),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::TokenInfo;
    use user_canister::swap_tokens::{ExchangeArgs, ExchangeSwapArgs};

    #[test]
    fn swaps_are_upserted_by_swap_id() {
        init_stable_memory_map();
        let mut swaps = TokenSwaps::default();

        for swap_id in [3, 1, 2] {
            swaps.push_new(args(swap_id), true, false, swap_id as u64 * 10);
        }
        assert_eq!(swaps.len(), 3);

        let mut swap = swaps.get(2).unwrap();
        assert!(swap.success.is_none());
        swap.success = Some(Timestamped::new(true, 25));
        swaps.upsert(swap);

        assert_eq!(swaps.len(), 3);
        assert_eq!(swaps.get(2).unwrap().success.map(|s| s.value), Some(true));
        assert!(swaps.get(4).is_none());

        assert_eq!(swaps.all().iter().map(|s| s.args.swap_id).collect::<Vec<_>>(), vec![1, 2, 3]);
        assert_eq!(
            swaps.page(1, 5).iter().map(|s| s.args.swap_id).collect::<Vec<_>>(),
            vec![2, 3]
        );
        assert_eq!(swaps.page(0, 1).iter().map(|s| s.args.swap_id).collect::<Vec<_>>(), vec![1]);
    }

    #[test]
    fn swaps_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let mut swaps = TokenSwaps {
            on_heap: (1..=50u128)
                .map(|swap_id| (swap_id, TokenSwap::new(args(swap_id), false, true, swap_id as u64)))
                .collect(),
            count: 0,
        };

        assert_eq!(swaps.migrate_to_stable_memory(), 50);
        assert!(swaps.on_heap.is_empty());
        assert_eq!(swaps.migrate_to_stable_memory(), 0);

        assert_eq!(swaps.len(), 50);
        let all = swaps.all();
        assert_eq!(all.len(), 50);
        assert!(
            all.iter()
                .enumerate()
                .all(|(i, s)| s.args.swap_id == i as u128 + 1 && s.started == i as u64 + 1)
        );
        assert!(swaps.get(20).unwrap().auto_withdrawals);

        // Updating a migrated swap doesn't change the count
        swaps.upsert(swaps.get(20).unwrap());
        assert_eq!(swaps.len(), 50);

        // The heap isn't serialized
        let deserialized: TokenSwaps = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&swaps));
        assert_eq!(deserialized.len(), 50);
    }

    fn args(swap_id: u128) -> user_canister::swap_tokens::Args {
        let token = |symbol: &str, ledger: u8| TokenInfo {
            symbol: symbol.to_string(),
            ledger: Principal::from_slice(&[ledger; 10]),
            decimals: 8,
            fee: 10_000,
        };
        user_canister::swap_tokens::Args {
            swap_id,
            input_token: token("ICP", 1),
            output_token: token("CHAT", 2),
            input_amount: 1_000_000,
            exchange_args: ExchangeArgs::ICPSwap(ExchangeSwapArgs {
                swap_canister_id: Principal::from_slice(&[3; 10]),
                zero_for_one: true,
            }),
            min_output_amount: 500,
            pin: None,
        }
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
