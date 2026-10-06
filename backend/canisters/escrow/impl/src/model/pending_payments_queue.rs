use crate::model::swaps::Swap;
use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use types::{TimestampMillis, TokenInfo};

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

    pub fn push_refunds(&mut self, swap: &Swap, now: TimestampMillis) {
        if swap.token0_received {
            self.push(PendingPayment {
                principal: swap.offered_by,
                timestamp: now,
                token_info: swap.token0.clone(),
                amount: swap.amount0,
                swap_id: swap.id,
                reason: PendingPaymentReason::Refund,
                holds_deposit_lock: false,
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
                holds_deposit_lock: false,
            });
        }
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
    #[serde(alias = "user_id")]
    pub principal: Principal,
    pub timestamp: TimestampMillis,
    pub token_info: TokenInfo,
    pub amount: u128,
    pub swap_id: u32,
    pub reason: PendingPaymentReason,
    // Whether this is the refund of a deposit which was too low, which keeps the deposit locked until
    // the refund is made or dropped
    #[serde(default)]
    pub holds_deposit_lock: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum PendingPaymentReason {
    Swap(Principal), // The other party in the swap
    Refund,
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::UserId;

    // The escrow canister in production stores pending payments to a `UserId`, as below, which
    // must still deserialize now they are to a `Principal`
    #[test]
    fn pending_payment_to_user_id_deserializes() {
        #[derive(Serialize)]
        struct PendingPaymentToUserId {
            user_id: UserId,
            timestamp: TimestampMillis,
            token_info: TokenInfo,
            amount: u128,
            swap_id: u32,
            reason: PendingPaymentReasonToUserId,
        }

        #[derive(Serialize)]
        enum PendingPaymentReasonToUserId {
            Swap(UserId),
        }

        let user = Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8, 1, 1]);
        let other_user = Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 9, 1, 1]);
        let bytes = msgpack::serialize_then_unwrap(PendingPaymentToUserId {
            user_id: user.into(),
            timestamp: 1,
            token_info: TokenInfo {
                symbol: "ICP".to_string(),
                ledger: Principal::from_slice(&[2; 10]),
                decimals: 8,
                fee: 10_000,
            },
            amount: 100,
            swap_id: 3,
            reason: PendingPaymentReasonToUserId::Swap(other_user.into()),
        });

        let payment: PendingPayment = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(payment.principal, user);
        assert_eq!(payment.amount, 100);
        assert!(matches!(payment.reason, PendingPaymentReason::Swap(p) if p == other_user));
    }

    // The escrow canister in production stores its queue without any parked payments, which must
    // still deserialize
    #[test]
    fn queue_without_parked_payments_deserializes() {
        #[derive(Serialize)]
        struct PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque<PendingPayment>,
        }

        let bytes = msgpack::serialize_then_unwrap(PendingPaymentsQueueWithoutParked {
            pending_payments: VecDeque::new(),
        });

        let queue: PendingPaymentsQueue = msgpack::deserialize_then_unwrap(&bytes);
        assert!(queue.is_empty());
        assert_eq!(queue.parked_len(), 0);
    }
}
