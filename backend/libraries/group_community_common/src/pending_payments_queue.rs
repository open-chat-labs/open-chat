use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{CanisterId, UserId, UserIdAndPrincipal};

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
    // Paid at `icrc1::Account::legacy_for_user`, so `MemberV2` should be used instead
    Member(UserId),
    Account(Account),
    MemberV2(UserIdAndPrincipal),
}

impl PaymentRecipient {
    // The member being paid, if the payment is to one
    pub fn member(&self) -> Option<UserId> {
        match self {
            PaymentRecipient::Member(user_id) => Some(*user_id),
            PaymentRecipient::MemberV2(user) => Some(user.user_id),
            PaymentRecipient::SnsTreasury | PaymentRecipient::TreasuryCanister | PaymentRecipient::Account(_) => None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    AccessGate,
    TransferToCommunityBeingImportedInto,
}
