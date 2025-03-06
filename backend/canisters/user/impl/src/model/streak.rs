use serde::{Deserialize, Serialize};
use types::{
    Milliseconds, StreakInsurance, TimestampMillis, UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment,
};

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000
const MS_IN_DAY: Milliseconds = 1000 * 60 * 60 * 24;

#[derive(Serialize, Deserialize, Default)]
pub struct Streak {
    start_day: u16,
    end_day: u16,
    #[serde(default)]
    max_streak: u16,
    #[serde(default)]
    insurance_last_updated: TimestampMillis,
    #[serde(default)]
    days_insured: u8,
    #[serde(default)]
    days_missed: u8,
    #[serde(default)]
    payment_lock: bool,
    #[serde(default)]
    payments: Vec<UserCanisterStreakInsurancePayment>,
    #[serde(default)]
    claims: Vec<UserCanisterStreakInsuranceClaim>,
}

impl Streak {
    pub fn days(&self, now: TimestampMillis) -> u16 {
        if let Some(today) = Streak::timestamp_to_day(now) {
            if !self.is_new_streak(today) {
                return 1 + self.end_day - self.start_day;
            }
        }

        0
    }

    pub fn ends(&self) -> TimestampMillis {
        Streak::day_to_timestamp(self.end_day + 2)
    }

    pub fn claim(&mut self, now: TimestampMillis) -> Result<Option<UserCanisterStreakInsuranceClaim>, ()> {
        if let Some(today) = Streak::timestamp_to_day(now) {
            if today > self.end_day {
                if self.is_new_streak(today) {
                    if let Some(insurance_claim) = self.claim_via_insurance(now) {
                        // This can happen if the user claims just after midnight, before the timer job runs
                        self.set_end_day(today);
                        return Ok(Some(insurance_claim));
                    }
                    self.start_day = today;
                    self.insurance_last_updated = now;
                    self.days_insured = 0;
                    self.days_missed = 0;
                }

                self.set_end_day(today);
                return Ok(None);
            }
        }

        Err(())
    }

    pub fn claim_via_insurance(&mut self, now: TimestampMillis) -> Option<UserCanisterStreakInsuranceClaim> {
        if !self.has_insurance() {
            return None;
        }

        if let Some(today) = Streak::timestamp_to_day(now) {
            if today == self.end_day + 2 {
                self.set_end_day(self.end_day + 1);
                self.days_missed += 1;
                self.insurance_last_updated = now;

                let claim = UserCanisterStreakInsuranceClaim {
                    timestamp: now,
                    streak_length: self.end_day - self.start_day,
                    new_days_claimed: self.days_missed,
                };
                self.claims.push(claim.clone());
                return Some(claim);
            }
        }
        None
    }

    pub fn can_claim(&self, now: TimestampMillis) -> bool {
        if let Some(today) = Streak::timestamp_to_day(now) {
            today > self.end_day
        } else {
            false
        }
    }

    pub fn max_streak(&self) -> u16 {
        self.max_streak
    }

    pub fn timestamp_to_day(ts: TimestampMillis) -> Option<u16> {
        if ts < DAY_ZERO {
            return None;
        }

        let day = (ts - DAY_ZERO) / MS_IN_DAY;

        if day > (u16::MAX as u64) {
            return None;
        }

        Some(day as u16)
    }

    pub fn insurance_last_updated(&self) -> TimestampMillis {
        self.insurance_last_updated
    }

    pub fn acquire_payment_lock(&mut self) -> bool {
        if self.payment_lock {
            false
        } else {
            self.payment_lock = true;
            true
        }
    }

    pub fn release_payment_lock(&mut self) {
        self.payment_lock = false
    }

    pub fn has_insurance(&self) -> bool {
        self.days_insured > self.days_missed
    }

    // This will return `Some(_)` even if the insurance has been used up, since the price of
    // additional days depends on how many days have already been insured
    pub fn streak_insurance(&self, now: TimestampMillis) -> Option<StreakInsurance> {
        if self.days_insured == 0 || now > self.ends() {
            None
        } else {
            Some(StreakInsurance {
                days_insured: self.days_insured,
                days_missed: self.days_missed,
            })
        }
    }

    pub fn mark_streak_insurance_payment(&mut self, payment: UserCanisterStreakInsurancePayment) {
        self.insurance_last_updated = payment.timestamp;
        self.days_insured = payment.new_days_insured;
        self.payments.push(payment);
    }

    pub fn insurance_price(&self, days_currently_insured: u8, additional_days: u8) -> u128 {
        let mut total = 0;
        for i in 0..additional_days {
            total += Self::insurance_cost_for_day(days_currently_insured + i);
        }
        total
    }

    fn set_end_day(&mut self, day: u16) {
        self.end_day = day;
        let streak = 1 + self.end_day - self.start_day;
        if streak > self.max_streak {
            self.max_streak = streak;
        }
    }

    fn is_new_streak(&self, today: u16) -> bool {
        today > (self.end_day + 1)
    }

    fn day_to_timestamp(day: u16) -> TimestampMillis {
        DAY_ZERO + MS_IN_DAY * day as u64
    }

    fn insurance_cost_for_day(day_index: u8) -> u128 {
        2u128.pow(day_index as u32) * 100_000_000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_claimed_can_claim() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let streak = Streak::default();
        assert!(streak.can_claim(now));
    }

    #[test]
    fn claim_once_on_1_day_streak() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn claim_once_per_day_only() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());
        assert!(streak.claim(now).is_err());
    }

    #[test]
    fn claim_again_next_day() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());

        now += MS_IN_DAY;
        assert!(streak.claim(now).is_ok());
        assert_eq!(2, streak.days(now));
    }

    #[test]
    fn claim_again_nearly_next_day_fails() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());

        now += MS_IN_DAY - 1;
        assert!(streak.claim(now).is_err());
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn streak_reset_the_following_day() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        streak.claim(now).unwrap();

        now += MS_IN_DAY;
        streak.claim(now).unwrap();

        now += MS_IN_DAY * 2;
        assert_eq!(0, streak.days(now));
    }
}
