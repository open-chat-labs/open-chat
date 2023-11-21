use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use types::{TimestampMillis, Timestamped};
use user_canister::token_swap_status::TokenSwapStatus;

#[derive(Serialize, Deserialize, Default)]
pub struct TokenSwaps {
    swaps: HashMap<u128, TokenSwap>,
    queued: VecDeque<u128>,
}

impl TokenSwaps {
    pub fn upsert(&mut self, swap: TokenSwap) {
        self.swaps.insert(swap.args.swap_id, swap);
    }

    pub fn get(&self, swap_id: u128) -> Option<&TokenSwap> {
        self.swaps.get(&swap_id)
    }

    pub fn enqueue(&mut self, swap_id: u128) {
        self.queued.push_back(swap_id)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TokenSwap {
    pub args: user_canister::swap_tokens::Args,
    pub started: TimestampMillis,
    pub deposit_account: SwapSubtask<Account>,
    pub transfer: SwapSubtask<u64>, // Block Index
    pub notified_dex_at: SwapSubtask,
    pub amount_swapped: SwapSubtask<u128>,
    pub withdrawn_from_dex_at: SwapSubtask,
    pub success: Option<Timestamped<bool>>,
}

type SwapSubtask<T = ()> = Option<Timestamped<Result<T, String>>>;

impl TokenSwap {
    pub fn new(args: user_canister::swap_tokens::Args, now: TimestampMillis) -> TokenSwap {
        TokenSwap {
            args,
            started: now,
            deposit_account: None,
            transfer: None,
            notified_dex_at: None,
            amount_swapped: None,
            withdrawn_from_dex_at: None,
            success: None,
        }
    }
}

impl From<TokenSwap> for TokenSwapStatus {
    fn from(value: TokenSwap) -> Self {
        TokenSwapStatus {
            started: value.started,
            deposit_account: value.deposit_account.map(|a| a.value),
            transfer: value.transfer.map(|t| t.value),
            notified_dex: value.notified_dex_at.map(|t| t.value.map(|_| ())),
            amount_swapped: value.amount_swapped.map(|t| t.value),
            withdrawn_from_dex: value.withdrawn_from_dex_at.map(|t| t.value.map(|_| ())),
        }
    }
}
