use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{
    Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration, DiamondMembershipSubscription, Milliseconds,
    TimestampMillis,
};
use user_index_canister::pay_for_diamond_membership::CannotExtendResult;
use utils::time::DAY_IN_MS;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(from = "DiamondMembershipDetailsInternalCombined")]
pub struct DiamondMembershipDetailsInternal {
    expires_at: Option<TimestampMillis>,
    payments: Vec<DiamondMembershipPayment>,
    pay_in_chat: bool,
    subscription: DiamondMembershipSubscription,
    payment_in_progress: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DiamondMembershipDetailsInternalCombined {
    expires_at: Option<TimestampMillis>,
    payments: Vec<DiamondMembershipPayment>,
    #[serde(default)]
    pay_in_chat: bool,
    #[serde(default)]
    subscription: Option<DiamondMembershipSubscription>,
    #[serde(default)]
    recurring: bool,
    payment_in_progress: bool,
}

impl From<DiamondMembershipDetailsInternalCombined> for DiamondMembershipDetailsInternal {
    fn from(value: DiamondMembershipDetailsInternalCombined) -> Self {
        let subscription = value.subscription.unwrap_or_else(|| {
            if value.recurring {
                value.payments.last().map(|p| p.duration.into()).unwrap_or_default()
            } else {
                DiamondMembershipSubscription::Disabled
            }
        });

        DiamondMembershipDetailsInternal {
            expires_at: value.expires_at,
            payments: value.payments,
            pay_in_chat: value.pay_in_chat,
            subscription,
            payment_in_progress: value.payment_in_progress,
        }
    }
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

const THREE_MONTHS: Milliseconds = DiamondMembershipPlanDuration::ThreeMonths.as_millis();

impl DiamondMembershipDetailsInternal {
    pub fn expires_at(&self) -> Option<TimestampMillis> {
        self.expires_at
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.expires_at.map_or(false, |ts| now < ts)
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
    pub fn hydrate(&self, now: TimestampMillis) -> Option<DiamondMembershipDetails> {
        self.expires_at.filter(|&ts| now < ts).map(|ts| DiamondMembershipDetails {
            expires_at: ts,
            pay_in_chat: self.pay_in_chat,
            recurring: self.subscription.is_active().then(|| self.subscription),
            subscription: self.subscription,
        })
    }

    pub fn can_extend(&self, now: TimestampMillis) -> Result<(), CannotExtendResult> {
        self.expires_at.map_or(Ok(()), |ts| {
            let remaining_until_expired = ts.saturating_sub(now);

            // Users can extend when there is < 3 months remaining
            let remaining_until_can_extend = remaining_until_expired.saturating_sub(THREE_MONTHS);

            if remaining_until_can_extend == 0 {
                Ok(())
            } else {
                Err(CannotExtendResult {
                    can_extend_at: now.saturating_add(remaining_until_can_extend),
                    diamond_membership_expires_at: ts,
                })
            }
        })
    }

    pub fn is_lifetime_diamond_member(&self) -> bool {
        self.expires_at > Some(30000000000000) // This timestamp is in the year 2920
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
}
