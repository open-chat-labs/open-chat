use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{CanisterId, TimestampNanos};

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

    pub fn len(&self) -> usize {
        self.pending_payments.len()
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
    pub amount: u64,
    pub token_symbol: String,
    pub ledger: CanisterId,
    pub fee: u128,
    pub timestamp: TimestampNanos,
    pub recipient_account: Account,
    pub memo: [u8; 32],
    pub reason: PendingPaymentReason,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum PendingPaymentReason {
    Treasury,
    TopUpNeuron,
    Burn,
}

#[cfg(test)]
mod tests {
    use super::*;

    // The UserIndex stores its queue without any parked payments until it is upgraded, so such a
    // queue must still deserialize
    #[test]
    fn queue_without_parked_payments_deserializes() {
        #[derive(Serialize)]
        struct PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque<PendingPayment>,
        }

        let bytes = msgpack::serialize_then_unwrap(PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque::from([PendingPayment {
                amount: 100,
                token_symbol: "ICP".to_string(),
                ledger: CanisterId::anonymous(),
                fee: 10,
                timestamp: 1,
                recipient_account: Account::from(CanisterId::anonymous()),
                memo: [0; 32],
                reason: PendingPaymentReason::Treasury,
            }]),
        });

        let mut queue: PendingPaymentsQueue = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(queue.parked_len(), 0);
        assert_eq!(queue.pop().unwrap().amount, 100);
        assert!(queue.is_empty());
    }
}
