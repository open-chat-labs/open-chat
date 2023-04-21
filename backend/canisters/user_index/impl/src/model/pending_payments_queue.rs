use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{Cryptocurrency, TimestampNanos};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingPaymentsQueue {
    pending_payments: VecDeque<PendingPayment>,
}

impl PendingPaymentsQueue {
    pub fn push(&mut self, pending_payment: PendingPayment) {
        self.pending_payments.push_back(pending_payment);
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
    pub amount: u64,
    pub currency: Cryptocurrency,
    pub timestamp: TimestampNanos,
    pub recipient: Principal,
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum PendingPaymentReason {
    Treasury,
    ReferralReward,
    BitcoinMiamiReferral,
}
