use crate::model::swaps::Swap;
use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{TimestampMillis, TokenInfo};

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
                principal: swap.offered_by,
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
                principal: accepted_by,
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
    #[serde(alias = "user_id")]
    pub principal: Principal,
    pub timestamp: TimestampMillis,
    pub token_info: TokenInfo,
    pub amount: u128,
    pub swap_id: u32,
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    Swap(Principal), // The other party in the swap
    Refund,
}
