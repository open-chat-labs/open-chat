use crate::SwapMetrics;
use candid::Principal;
use constants::{MINUTE_IN_MS, P2P_SWAP_MAX_EXPIRY};
use escrow_canister::{SwapStatus, SwapStatusAccepted, SwapStatusCancelled, SwapStatusCompleted, SwapStatusExpired};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{CanisterId, Milliseconds, P2PSwapLocation, TimestampMillis, TokenInfo, icrc1::CompletedCryptoTransaction};

// The caller works out a swap's expiry from its own clock, which may be a little ahead of this
// canister's
const CLOCK_DIFFERENCE_ALLOWED: Milliseconds = 5 * MINUTE_IN_MS;

// The latest a swap created at `created_at` may expire
pub fn latest_allowed_expiry(created_at: TimestampMillis) -> TimestampMillis {
    created_at + P2P_SWAP_MAX_EXPIRY + CLOCK_DIFFERENCE_ALLOWED
}

#[derive(Serialize, Deserialize, Default)]
pub struct Swaps {
    map: BTreeMap<u32, Swap>,
}

impl Swaps {
    pub fn push(&mut self, caller: Principal, args: escrow_canister::create_swap::Args, now: TimestampMillis) -> u32 {
        let id = self.map.last_key_value().map(|(k, _)| *k + 1).unwrap_or_default();
        self.map.insert(id, Swap::new(id, caller, args, now));
        id
    }

    pub fn get(&self, id: u32) -> Option<&Swap> {
        self.map.get(&id)
    }

    pub fn get_mut(&mut self, id: u32) -> Option<&mut Swap> {
        self.map.get_mut(&id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Swap> {
        self.map.values()
    }

    pub fn metrics(&self, now: TimestampMillis) -> SwapMetrics {
        let mut metrics = SwapMetrics {
            total: self.map.len() as u32,
            ..Default::default()
        };

        for swap in self.map.values() {
            match swap.status(now) {
                SwapStatus::Open => metrics.open += 1,
                SwapStatus::Cancelled(_) => metrics.cancelled += 1,
                SwapStatus::Expired(_) => metrics.expired += 1,
                SwapStatus::Accepted(_) => metrics.accepted += 1,
                SwapStatus::Completed(_) => metrics.completed += 1,
            }
        }

        metrics
    }
}

#[derive(Serialize, Deserialize)]
pub struct Swap {
    pub id: u32,
    pub location: P2PSwapLocation,
    pub is_public: bool,
    pub created_at: TimestampMillis,
    pub created_by: Principal,
    pub offered_by: Principal,
    pub restricted_to: Option<Principal>,
    pub token0: TokenInfo,
    pub amount0: u128,
    pub token1: TokenInfo,
    pub amount1: u128,
    pub expires_at: TimestampMillis,
    pub cancelled_at: Option<TimestampMillis>,
    pub accepted_by: Option<(Principal, TimestampMillis)>,
    pub token0_received: bool,
    pub token1_received: bool,
    pub token0_transfer_out: Option<CompletedCryptoTransaction>,
    pub token1_transfer_out: Option<CompletedCryptoTransaction>,
    pub refunds: Vec<CompletedCryptoTransaction>,
    pub additional_admins: Vec<Principal>,
    pub canister_to_notify: Option<CanisterId>,
    pub errors: Vec<String>,
    // The depositors whose deposit is locked. A deposit is locked while a notification checks its
    // balance, and if the balance is too low, until the deposit's refund is made. So no two checks of a
    // deposit overlap, and none overlaps its refund, so a deposit can't be topped up and recorded before
    // its refund drains it.
    #[serde(default)]
    pub locked_deposits: BTreeSet<Principal>,
}

impl Swap {
    pub fn new(id: u32, caller: Principal, args: escrow_canister::create_swap::Args, now: TimestampMillis) -> Swap {
        let offered_by = args.token0_principal.unwrap_or(caller);

        Swap {
            id,
            location: args.location,
            is_public: args.is_public,
            created_at: now,
            created_by: caller,
            offered_by,
            restricted_to: args.token1_principal,
            token0: args.token0,
            amount0: args.token0_amount,
            token1: args.token1,
            amount1: args.token1_amount,
            expires_at: args.expires_at,
            cancelled_at: None,
            accepted_by: None,
            token0_received: false,
            token1_received: false,
            token0_transfer_out: None,
            token1_transfer_out: None,
            refunds: Vec::new(),
            additional_admins: args.additional_admins,
            canister_to_notify: args.canister_to_notify,
            errors: Vec::new(),
            locked_deposits: BTreeSet::new(),
        }
    }

    pub fn is_admin(&self, principal: Principal) -> bool {
        self.created_by == principal
            || self.offered_by == principal
            || self.restricted_to.is_some_and(|restricted_to| restricted_to == principal)
            || self.additional_admins.contains(&principal)
    }

    pub fn is_complete(&self) -> bool {
        self.token0_transfer_out.is_some() && self.token1_transfer_out.is_some()
    }

    // Whether a payment made in this block of this ledger has been recorded against the swap
    pub fn is_payment_recorded(&self, ledger: CanisterId, block_index: u64) -> bool {
        self.token0_transfer_out
            .iter()
            .chain(&self.token1_transfer_out)
            .chain(&self.refunds)
            .any(|transfer| transfer.ledger == ledger && transfer.block_index == block_index)
    }

    pub fn status(&self, now: TimestampMillis) -> SwapStatus {
        if let Some((accepted_by, accepted_at)) = self.token0_received.then_some(self.accepted_by).flatten() {
            if let (Some(token0_transfer_out), Some(token1_transfer_out)) =
                (self.token0_transfer_out.clone(), self.token1_transfer_out.clone())
            {
                SwapStatus::Completed(Box::new(SwapStatusCompleted {
                    accepted_by,
                    accepted_at,
                    token0_transfer_out,
                    token1_transfer_out,
                    refunds: self.refunds.clone(),
                }))
            } else {
                SwapStatus::Accepted(Box::new(SwapStatusAccepted {
                    accepted_by,
                    accepted_at,
                }))
            }
        } else if let Some(cancelled_at) = self.cancelled_at {
            SwapStatus::Cancelled(Box::new(SwapStatusCancelled {
                cancelled_at,
                refunds: self.refunds.clone(),
            }))
        } else if self.expires_at <= now {
            SwapStatus::Expired(Box::new(SwapStatusExpired {
                refunds: self.refunds.clone(),
            }))
        } else {
            SwapStatus::Open
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::icrc1::Account;

    fn token(ledger: u8) -> TokenInfo {
        TokenInfo {
            symbol: format!("TOKEN{ledger}"),
            ledger: CanisterId::from_slice(&[ledger]),
            decimals: 8,
            fee: 10_000,
        }
    }

    fn transfer(ledger: u8, block_index: u64) -> CompletedCryptoTransaction {
        let account = Account::from(Principal::from_slice(&[9]));
        CompletedCryptoTransaction {
            ledger: CanisterId::from_slice(&[ledger]),
            token_symbol: format!("TOKEN{ledger}"),
            amount: 1_000,
            from: account.into(),
            to: account.into(),
            fee: 10_000,
            memo: None,
            created: 0,
            block_index,
        }
    }

    #[test]
    fn payment_is_recorded_only_for_its_ledger_and_block() {
        let mut swap = Swap::new(
            0,
            Principal::from_slice(&[9]),
            escrow_canister::create_swap::Args {
                location: P2PSwapLocation::External,
                token0: token(1),
                token0_amount: 1_000,
                token0_principal: None,
                token1: token(2),
                token1_amount: 1_000,
                token1_principal: None,
                expires_at: 1,
                additional_admins: Vec::new(),
                canister_to_notify: None,
                is_public: false,
            },
            0,
        );
        swap.token0_transfer_out = Some(transfer(1, 5));
        swap.token1_transfer_out = Some(transfer(2, 6));
        swap.refunds.push(transfer(1, 7));

        assert!(swap.is_payment_recorded(CanisterId::from_slice(&[1]), 5));
        assert!(swap.is_payment_recorded(CanisterId::from_slice(&[2]), 6));
        assert!(swap.is_payment_recorded(CanisterId::from_slice(&[1]), 7));
        // Block indexes are per ledger
        assert!(!swap.is_payment_recorded(CanisterId::from_slice(&[2]), 5));
        assert!(!swap.is_payment_recorded(CanisterId::from_slice(&[1]), 8));
    }
}
