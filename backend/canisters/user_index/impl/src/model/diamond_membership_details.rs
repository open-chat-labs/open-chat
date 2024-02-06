use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{
    is_default, is_empty_slice, Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration,
    DiamondMembershipStatus, DiamondMembershipStatusFull, DiamondMembershipSubscription, TimestampMillis,
};
use utils::time::DAY_IN_MS;

const LIFETIME_TIMESTAMP: TimestampMillis = 30000000000000; // This timestamp is in the year 2920

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DiamondMembershipDetailsInternal {
    #[serde(rename = "e", alias = "expires_at", default, skip_serializing_if = "Option::is_none")]
    expires_at: Option<TimestampMillis>,
    #[serde(rename = "p", alias = "payments", default, skip_serializing_if = "is_empty_slice")]
    payments: Vec<DiamondMembershipPayment>,
    #[serde(rename = "c", alias = "pay_in_chat", default, skip_serializing_if = "is_default")]
    pay_in_chat: bool,
    #[serde(rename = "s", alias = "subscription", default, skip_serializing_if = "is_default")]
    subscription: DiamondMembershipSubscription,
    #[serde(skip)]
    payment_in_progress: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DiamondMembershipPayment {
    pub timestamp: TimestampMillis,
    pub token: Cryptocurrency,
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
        self.expires_at.map_or(false, |ts| now < ts)
    }

    pub fn status(&self, now: TimestampMillis) -> DiamondMembershipStatus {
        match self.expires_at {
            Some(ts) if ts > LIFETIME_TIMESTAMP => DiamondMembershipStatus::Lifetime,
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

    #[allow(deprecated)]
    pub fn status_full(&self, now: TimestampMillis) -> DiamondMembershipStatusFull {
        match self.expires_at {
            Some(ts) if ts > LIFETIME_TIMESTAMP => DiamondMembershipStatusFull::Lifetime,
            Some(ts) if ts > now => DiamondMembershipStatusFull::Active(DiamondMembershipDetails {
                expires_at: ts,
                pay_in_chat: self.pay_in_chat,
                recurring: Some(self.subscription),
                subscription: self.subscription,
            }),
            _ => DiamondMembershipStatusFull::Inactive,
        }
    }

    #[allow(deprecated)]
    pub fn hydrate(&self, now: TimestampMillis) -> Option<DiamondMembershipDetails> {
        self.expires_at.filter(|&ts| now < ts).map(|ts| DiamondMembershipDetails {
            expires_at: ts,
            pay_in_chat: self.pay_in_chat,
            recurring: self.subscription.is_active().then_some(self.subscription),
            subscription: self.subscription,
        })
    }

    pub fn is_lifetime_diamond_member(&self) -> bool {
        self.expires_at > Some(LIFETIME_TIMESTAMP)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add_payment(
        &mut self,
        token: Cryptocurrency,
        amount_e8s: u64,
        block_index: u64,
        duration: DiamondMembershipPlanDuration,
        recurring: bool,
        manual_payment: bool,
        now: TimestampMillis,
    ) {
        let payment = DiamondMembershipPayment {
            timestamp: now,
            token,
            amount_e8s,
            block_index,
            duration,
            manual_payment,
        };

        let duration_millis = duration.as_millis();
        self.expires_at = Some(max(now, self.expires_at.unwrap_or_default()) + duration_millis);
        self.pay_in_chat = matches!(payment.token, Cryptocurrency::CHAT);
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
