use crate::model::swaps::Swap;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{TimestampMillis, TokenInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingPaymentsQueue {
    pending_payments: VecDeque<PendingPayment>,
}

impl PendingPaymentsQueue {
    pub fn push(&mut self, pending_payment: PendingPayment) {
        self.pending_payments.push_back(pending_payment);
    }

    pub fn push_refunds(&mut self, swap: &Swap, now: TimestampMillis) {
        if swap.token0_received {
            self.push(PendingPayment {
                user_id: swap.offered_by.into(),
                timestamp: now,
                token_info: swap.token0.clone(),
                amount: swap.amount0,
                swap_id: swap.id,
                reason: PendingPaymentReason::Refund,
            });
        }
        if swap.token1_received
            && let Some((accepted_by, _)) = swap.accepted_by
        {
            self.push(PendingPayment {
                user_id: accepted_by.into(),
                timestamp: now,
                token_info: swap.token1.clone(),
                amount: swap.amount1,
                swap_id: swap.id,
                reason: PendingPaymentReason::Refund,
            });
        }
    }

    pub fn pop(&mut self) -> Option<PendingPayment> {
        self.pending_payments.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.pending_payments.is_empty()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PendingPayment {
    // A UserId rather than a Principal because the payout must go to the user's wallet - for an
    // indexed user that is a subaccount of their holding canister, while their raw principal is an
    // account nobody can sign for.
    #[serde(alias = "principal")]
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub token_info: TokenInfo,
    pub amount: u128,
    pub swap_id: u32,
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    Swap(UserId), // The other party in the swap
    Refund,
}
