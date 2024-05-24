use crate::SwapMetrics;
use candid::Principal;
use escrow_canister::{SwapStatus, SwapStatusAccepted, SwapStatusCancelled, SwapStatusCompleted, SwapStatusExpired};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{icrc1::CompletedCryptoTransaction, CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Swaps {
    map: BTreeMap<u32, Swap>,
}

impl Swaps {
    pub fn push(&mut self, caller: UserId, args: escrow_canister::create_swap::Args, now: TimestampMillis) -> u32 {
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
    pub created_at: TimestampMillis,
    pub created_by: UserId,
    pub token0: TokenInfo,
    pub amount0: u128,
    pub token1: TokenInfo,
    pub amount1: u128,
    pub expires_at: TimestampMillis,
    pub cancelled_at: Option<TimestampMillis>,
    pub accepted_by: Option<(UserId, TimestampMillis)>,
    pub token0_received: bool,
    pub token1_received: bool,
    pub token0_transfer_out: Option<CompletedCryptoTransaction>,
    pub token1_transfer_out: Option<CompletedCryptoTransaction>,
    pub refunds: Vec<CompletedCryptoTransaction>,
    pub additional_admins: Vec<Principal>,
    pub canister_to_notify: Option<CanisterId>,
}

impl Swap {
    pub fn new(id: u32, caller: UserId, args: escrow_canister::create_swap::Args, now: TimestampMillis) -> Swap {
        Swap {
            id,
            location: args.location,
            created_at: now,
            created_by: caller,
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
        }
    }

    pub fn is_admin(&self, principal: Principal) -> bool {
        self.created_by == principal.into() || self.additional_admins.contains(&principal)
    }

    pub fn is_complete(&self) -> bool {
        self.token0_transfer_out.is_some() && self.token1_transfer_out.is_some()
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
