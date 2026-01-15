use crate::token_swaps::swap_client::SwapSuccess;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::icrc1::Account;
use types::{TimestampMillis, Timestamped};
use user_canister::token_swap_status::TokenSwapStatus;

#[derive(Serialize, Deserialize, Default)]
pub struct TokenSwaps {
    swaps: HashMap<u128, TokenSwap>,
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
        self.swaps.insert(swap.args.swap_id, swap);
    }

    pub fn get(&self, swap_id: u128) -> Option<&TokenSwap> {
        self.swaps.get(&swap_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &TokenSwap> {
        self.swaps.values()
    }

    pub fn len(&self) -> usize {
        self.swaps.len()
    }
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
