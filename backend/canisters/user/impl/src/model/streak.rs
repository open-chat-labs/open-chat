use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use tracing::info;
use types::{StreakInsurance, TimestampMillis, UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment};

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000
const MAX_UTC_OFFSET_MINS: i16 = 15 * 60; // 15 hours

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Streak {
    start_day: u16,
    end_day: u16,
    max_streak: u16,
    insurance_last_updated: TimestampMillis,
    days_insured: u8,
    days_missed: u8,
    #[serde(skip)]
    payment_lock: bool,
    payments: Vec<UserCanisterStreakInsurancePayment>,
    claims: Vec<UserCanisterStreakInsuranceClaim>,
    utc_offset_mins: i16,
    utc_offset_updates: Vec<(TimestampMillis, i16)>,
}

impl Streak {
    pub fn days(&self, now: TimestampMillis) -> u16 {
        if let Some(today) = self.timestamp_to_day(now) {
            if !self.is_new_streak(today) {
                return 1 + self.end_day - self.start_day;
            }
        }

        0
    }

    pub fn ends(&self) -> TimestampMillis {
        self.day_to_timestamp(self.end_day + 2)
    }

    pub fn claim(&mut self, now: TimestampMillis) -> Result<Option<UserCanisterStreakInsuranceClaim>, TimestampMillis> {
        if let Some(today) = self.timestamp_to_day(now) {
            if today > self.end_day {
                if self.is_new_streak(today) {
                    if let Some(insurance_claim) = self.claim_via_insurance(now) {
                        // This can happen if the user claims just after midnight, before the timer job runs
                        self.set_end_day(today);
                        return Ok(Some(insurance_claim));
                    }
                    self.start_day = today;
                    self.reset_streak_insurance(now);
                }

                self.set_end_day(today);
                return Ok(None);
            }
        }

        Err(self.next_claim())
    }

    pub fn claim_via_insurance(&mut self, now: TimestampMillis) -> Option<UserCanisterStreakInsuranceClaim> {
        if !self.has_insurance() {
            return None;
        }

        if let Some(today) = self.timestamp_to_day(now) {
            if today == self.end_day + 2 {
                self.set_end_day(self.end_day + 1);
                self.days_missed += 1;
                self.insurance_last_updated = now;

                let claim = UserCanisterStreakInsuranceClaim {
                    // The timestamp of the end of the day for which the claim applied
                    timestamp: self.final_timestamp_of_day(today - 1),
                    streak_length: self.end_day - self.start_day,
                    new_days_claimed: self.days_missed,
                    insured_days_remaining: self.days_insured.saturating_sub(self.days_missed),
                };
                self.claims.push(claim.clone());
                info!(day = today, "Streak insurance used");
                return Some(claim);
            }
        }
        None
    }

    pub fn reset_streak_insurance(&mut self, now: TimestampMillis) {
        self.days_insured = 0;
        self.days_missed = 0;
        self.insurance_last_updated = now;
    }

    pub fn next_claim(&self) -> TimestampMillis {
        self.day_to_timestamp(self.end_day + 1)
    }

    pub fn max_streak(&self) -> u16 {
        self.max_streak
    }

    pub fn set_utc_offset_mins(&mut self, utc_offset_mins: i16, now: TimestampMillis) -> bool {
        if utc_offset_mins != self.utc_offset_mins && utc_offset_mins.abs() < MAX_UTC_OFFSET_MINS {
            self.utc_offset_mins = utc_offset_mins;
            self.utc_offset_updates.push((now, utc_offset_mins));
            true
        } else {
            false
        }
    }

    pub fn timestamp_to_day(&self, ts: TimestampMillis) -> Option<u16> {
        Self::timestamp_to_offset_day(ts, self.utc_offset_mins)
    }

    pub fn timestamp_to_offset_day(ts: TimestampMillis, utc_offset_mins: i16) -> Option<u16> {
        let utc_offset_ms = mins_to_ms(utc_offset_mins);
        let local = (ts as i64 + utc_offset_ms) as u64;

        if local < DAY_ZERO {
            return None;
        }

        let day = (local - DAY_ZERO) / DAY_IN_MS;

        if day > (u16::MAX as u64) {
            return None;
        }

        Some(day as u16)
    }

    pub fn day_to_timestamp(&self, day: u16) -> TimestampMillis {
        let utc_offset_ms = mins_to_ms(self.utc_offset_mins);
        (((DAY_ZERO + DAY_IN_MS * day as u64) as i64) - utc_offset_ms) as TimestampMillis
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

    pub fn days_insured(&self) -> u8 {
        self.days_insured
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

    pub fn utc_offset_mins_at_ts(&self, ts: TimestampMillis) -> i16 {
        self.utc_offset_updates
            .iter()
            .filter(|(updated_at, _)| *updated_at < ts)
            .next_back()
            .map(|(_, offset)| *offset)
            .unwrap_or_default()
    }

    pub fn set_end_day(&mut self, day: u16) {
        self.end_day = day;
        let streak = 1 + self.end_day - self.start_day;
        if streak > self.max_streak {
            self.max_streak = streak;
        }
    }

    fn is_new_streak(&self, today: u16) -> bool {
        today > (self.end_day + 1)
    }

    fn final_timestamp_of_day(&self, day: u16) -> TimestampMillis {
        self.day_to_timestamp(day + 1) - 1
    }

    fn insurance_cost_for_day(day_index: u8) -> u128 {
        2u128.pow(day_index as u32) * 100_000_000
    }
}

fn mins_to_ms(mins: i16) -> i64 {
    mins as i64 * 60 * 1000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_claimed_can_claim() {
        let now = DAY_ZERO + (60 * DAY_IN_MS);
        let streak = Streak::default();
        assert!(now > streak.next_claim());
    }

    #[test]
    fn claim_once_on_1_day_streak() {
        let now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn claim_once_per_day_only() {
        let now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());
        assert!(streak.claim(now).is_err());
    }

    #[test]
    fn claim_again_next_day() {
        let mut now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());

        now += DAY_IN_MS;
        assert!(streak.claim(now).is_ok());
        assert_eq!(2, streak.days(now));
    }

    #[test]
    fn claim_again_nearly_next_day_fails() {
        let mut now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        assert!(streak.claim(now).is_ok());

        now += DAY_IN_MS - 1;
        assert!(streak.claim(now).is_err());
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn streak_reset_the_following_day() {
        let mut now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        streak.claim(now).unwrap();

        now += DAY_IN_MS;
        streak.claim(now).unwrap();

        now += DAY_IN_MS * 2;
        assert_eq!(0, streak.days(now));
    }
}
