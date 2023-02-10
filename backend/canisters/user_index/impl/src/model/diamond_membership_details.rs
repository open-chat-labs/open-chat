use serde::{Deserialize, Serialize};
use std::{cmp::max, collections::HashMap};
use types::{Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration, Milliseconds, TimestampMillis};
use user_index_canister::pay_for_diamond_membership::CannotExtendResult;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DiamondMembershipDetailsInternal {
    expires_at: Option<TimestampMillis>,
    payments: Vec<DiamondMembershipPayment>,
    recurring: bool,
    payment_in_progress: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DiamondMembershipPayment {
    timestamp: TimestampMillis,
    token: Cryptocurrency,
    amount_e8s: u64,
    block_index: u64,
    duration: DiamondMembershipPlanDuration,
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
        self.recurring
    }

    pub fn amount_paid(&self) -> HashMap<Cryptocurrency, u128> {
        let mut paid_by_token: HashMap<Cryptocurrency, u128> = HashMap::new();

        for payment in self.payments.iter() {
            *paid_by_token.entry(payment.token).or_default() += payment.amount_e8s as u128;
        }

        paid_by_token
    }

    pub fn hydrate(&self, now: TimestampMillis) -> Option<DiamondMembershipDetails> {
        self.expires_at.filter(|&ts| now < ts).map(|ts| DiamondMembershipDetails {
            expires_at: ts,
            recurring: self.recurring.then(|| self.payments.last().map(|p| p.duration)).flatten(),
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

    pub fn add_payment(
        &mut self,
        token: Cryptocurrency,
        amount_e8s: u64,
        block_index: u64,
        duration: DiamondMembershipPlanDuration,
        recurring: bool,
        now: TimestampMillis,
    ) {
        let payment = DiamondMembershipPayment {
            timestamp: now,
            token,
            amount_e8s,
            block_index,
            duration,
        };

        let duration_millis = duration.as_millis();
        self.expires_at = Some(max(now, self.expires_at.unwrap_or_default()) + duration_millis);
        self.payments.push(payment);
        self.recurring = recurring;
        self.payment_in_progress = false;
    }

    pub fn payment_in_progress(&self) -> bool {
        self.payment_in_progress
    }

    pub fn set_payment_in_progress(&mut self, value: bool) {
        self.payment_in_progress = value;
    }

    #[allow(dead_code)]
    pub fn set_recurring(&mut self, value: bool) {
        self.recurring = value;
    }
}
