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
    // Queues a swap's payout. Refunds are queued with `push_refund`.
    pub fn push(&mut self, pending_payment: PendingPayment) {
        self.pending_payments.push_back(pending_payment);
    }

    // Queues a refund of `amount` to the depositor from their deposit subaccount, noting it against the
    // swap until it's made or given up on
    pub fn push_refund(
        &mut self,
        swap: &mut Swap,
        depositor: Principal,
        token_info: TokenInfo,
        amount: u128,
        now: TimestampMillis,
    ) {
        let refund = PendingPayment {
            principal: depositor,
            timestamp: now,
            token_info,
            amount,
            swap_id: swap.id,
            reason: PendingPaymentReason::Refund,
        };
        swap.on_refund_queued(depositor, refund.debit());
        self.push(refund);
    }

    pub fn push_refunds(&mut self, swap: &mut Swap, now: TimestampMillis) {
        if swap.token0_received {
            let (offered_by, token_info, amount) = (swap.offered_by, swap.token0.clone(), swap.amount0);
            self.push_refund(swap, offered_by, token_info, amount, now);
        }
        if swap.token1_received
            && let Some((accepted_by, _)) = swap.accepted_by
        {
            let (token_info, amount) = (swap.token1.clone(), swap.amount1);
            self.push_refund(swap, accepted_by, token_info, amount, now);
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

    // The payments queued or parked
    pub fn iter(&self) -> impl Iterator<Item = &PendingPayment> {
        self.pending_payments.iter().chain(&self.parked)
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
}

impl PendingPayment {
    // The amount the payment takes out of the subaccount it's made from, including the fee
    pub fn debit(&self) -> u128 {
        self.amount.saturating_add(self.token_info.fee)
    }
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
