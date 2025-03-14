use constants::{CHAT_LEDGER_CANISTER_ID, DAY_IN_MS, LIFETIME_DIAMOND_TIMESTAMP};
use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{
    is_default, CanisterId, DiamondMembershipDetails, DiamondMembershipPlanDuration, DiamondMembershipStatus,
    DiamondMembershipStatusFull, DiamondMembershipSubscription, TimestampMillis,
};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DiamondMembershipDetailsInternal {
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    expires_at: Option<TimestampMillis>,
    #[serde(rename = "p", default, skip_serializing_if = "Vec::is_empty")]
    payments: Vec<DiamondMembershipPayment>,
    #[serde(rename = "c", default, skip_serializing_if = "is_default")]
    pay_in_chat: bool,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    subscription: DiamondMembershipSubscription,
    #[serde(skip)]
    payment_in_progress: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DiamondMembershipPayment {
    pub timestamp: TimestampMillis,
    pub ledger: CanisterId,
    pub fee: u128,
    pub amount_e8s: u64,
    pub block_index: u64,
    pub duration: DiamondMembershipPlanDuration,
    pub manual_payment: bool,
}

impl DiamondMembershipDetailsInternal {
    pub fn expires_at(&self) -> Option<TimestampMillis> {
        self.expires_at
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.expires_at.is_some_and(|ts| now < ts)
    }

    pub fn was_active(&self, timestamp: TimestampMillis) -> bool {
        for p in self.payments.iter() {
            if timestamp < p.timestamp {
                return false;
            }

            if timestamp >= p.timestamp
                && (timestamp < (p.timestamp + p.duration.as_millis())
                    || matches!(p.duration, DiamondMembershipPlanDuration::Lifetime))
            {
                return true;
            }
        }

        false
    }

    pub fn status(&self, now: TimestampMillis) -> DiamondMembershipStatus {
        match self.expires_at {
            Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => DiamondMembershipStatus::Lifetime,
            Some(ts) if ts > now => DiamondMembershipStatus::Active,
            _ => DiamondMembershipStatus::Inactive,
        }
    }

    pub fn is_recurring(&self) -> bool {
        self.subscription.is_active()
    }

    pub fn is_recurring_payment_due(&self, now: TimestampMillis) -> bool {
        self.subscription.is_active()
            && self
                .expires_at
                .map(|ts| ts < now.saturating_add(DAY_IN_MS))
                .unwrap_or_default()
    }

    pub fn status_full(&self, now: TimestampMillis) -> DiamondMembershipStatusFull {
        match self.expires_at {
            Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => DiamondMembershipStatusFull::Lifetime,
            Some(ts) if ts > now => DiamondMembershipStatusFull::Active(DiamondMembershipDetails {
                expires_at: ts,
                pay_in_chat: self.pay_in_chat,
                subscription: self.subscription,
            }),
            _ => DiamondMembershipStatusFull::Inactive,
        }
    }

    pub fn hydrate(&self, now: TimestampMillis) -> Option<DiamondMembershipDetails> {
        self.expires_at.filter(|&ts| now < ts).map(|ts| DiamondMembershipDetails {
            expires_at: ts,
            pay_in_chat: self.pay_in_chat,
            subscription: self.subscription,
        })
    }

    pub fn is_lifetime_diamond_member(&self) -> bool {
        self.expires_at > Some(LIFETIME_DIAMOND_TIMESTAMP)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add_payment(
        &mut self,
        ledger: CanisterId,
        transfer_fee: u128,
        amount_e8s: u64,
        block_index: u64,
        duration: DiamondMembershipPlanDuration,
        recurring: bool,
        manual_payment: bool,
        now: TimestampMillis,
    ) {
        let payment = DiamondMembershipPayment {
            timestamp: now,
            ledger,
            fee: transfer_fee,
            amount_e8s,
            block_index,
            duration,
            manual_payment,
        };

        let duration_millis = duration.as_millis();
        self.expires_at = Some(max(now, self.expires_at.unwrap_or_default()) + duration_millis);
        self.pay_in_chat = payment.ledger == CHAT_LEDGER_CANISTER_ID;
        self.payments.push(payment);
        self.subscription = if recurring { duration.into() } else { DiamondMembershipSubscription::Disabled };
        self.payment_in_progress = false;
    }

    pub fn payment_in_progress(&self) -> bool {
        self.payment_in_progress
    }

    pub fn set_payment_in_progress(&mut self, value: bool) {
        self.payment_in_progress = value;
    }

    pub fn payments(&self) -> &[DiamondMembershipPayment] {
        &self.payments
    }

    pub fn pay_in_chat(&self) -> bool {
        self.pay_in_chat
    }

    pub fn set_pay_in_chat(&mut self, pay_in_chat: bool) {
        self.pay_in_chat = pay_in_chat;
    }

    pub fn subscription(&self) -> DiamondMembershipSubscription {
        self.subscription
    }

    pub fn set_subscription(&mut self, subscription: DiamondMembershipSubscription) {
        self.subscription = subscription;
    }

    pub fn has_ever_been_diamond_member(&self) -> bool {
        self.expires_at.is_some()
    }

    pub fn has_never_been_diamond_member(&self) -> bool {
        !self.has_ever_been_diamond_member()
    }
}
