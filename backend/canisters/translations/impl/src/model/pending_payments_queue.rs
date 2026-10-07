use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct PendingPaymentsQueue {
    pending_payments: VecDeque<PendingPayment>,
    // Payments which can't be made because their ledger has been uninstalled or deleted. They are
    // kept rather than dropped, in case they need to be made by hand.
    #[serde(default)]
    parked: Vec<PendingPayment>,
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

    pub fn park(&mut self, pending_payment: PendingPayment) {
        self.parked.push(pending_payment);
    }

    pub fn parked_len(&self) -> usize {
        self.parked.len()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PendingPayment {
    pub amount: u128,
    pub ledger: CanisterId,
    pub fee: u128,
    pub timestamp: TimestampMillis,
    pub recipient_account: Account,
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    Approval,
}

#[cfg(test)]
mod tests {
    use super::*;

    // The Translations canister stores its queue without any parked payments until it is upgraded, so
    // such a queue must still deserialize
    #[test]
    fn queue_without_parked_payments_deserializes() {
        #[derive(Serialize)]
        struct PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque<PendingPayment>,
        }

        let bytes = msgpack::serialize_then_unwrap(PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque::from([PendingPayment {
                amount: 100,
                ledger: CanisterId::anonymous(),
                fee: 10,
                timestamp: 1,
                recipient_account: Account::from(CanisterId::anonymous()),
                reason: PendingPaymentReason::Approval,
            }]),
        });

        let mut queue: PendingPaymentsQueue = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(queue.parked_len(), 0);
        assert_eq!(queue.pop().unwrap().amount, 100);
        assert!(queue.is_empty());
    }
}
