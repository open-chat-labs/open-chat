use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{CanisterId, UserId};

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
    pub amount: u128,
    pub fee: u128,
    pub ledger_canister: CanisterId,
    pub recipient: PaymentRecipient,
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize)]
pub enum PaymentRecipient {
    SnsTreasury,
    TreasuryCanister,
    Member(UserId),
    Account(Account),
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    AccessGate,
    TransferToCommunityBeingImportedInto,
}
