use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;
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
#[serde(from = "PendingPaymentCombined")]
pub struct PendingPayment {
    pub amount: u64,
    pub currency: Cryptocurrency,
    pub timestamp: TimestampNanos,
    pub recipient_account: Account,
    pub memo: [u8; 32],
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize)]
pub struct PendingPaymentCombined {
    pub amount: u64,
    pub currency: Cryptocurrency,
    pub timestamp: TimestampNanos,
    #[serde(default)]
    pub recipient_account: Option<Account>,
    #[serde(default)]
    pub recipient: Option<Principal>,
    pub memo: [u8; 32],
    pub reason: PendingPaymentReason,
}

impl From<PendingPaymentCombined> for PendingPayment {
    fn from(value: PendingPaymentCombined) -> Self {
        PendingPayment {
            amount: value.amount,
            currency: value.currency,
            timestamp: value.timestamp,
            recipient_account: value
                .recipient_account
                .or_else(|| value.recipient.map(Account::from))
                .unwrap(),
            memo: value.memo,
            reason: value.reason,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum PendingPaymentReason {
    Treasury,
    TopUpNeuron,
    Burn,
    ReferralReward,
}
