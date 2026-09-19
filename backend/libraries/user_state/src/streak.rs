use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, StreakInsuranceKeyPrefix, with_map_mut};
use std::collections::BTreeMap;
use tracing::info;
use types::{
    ChitEvent, ChitEventType, StreakInsurance, TimestampMillis, UserCanisterStreakInsuranceClaim,
    UserCanisterStreakInsurancePayment,
};

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
    // The insurance payments and claims are stored in the stable memory map for small entries.
    // Those which were held on the heap are all moved into stable memory in `post_upgrade` by
    // `migrate_to_stable_memory`, so these are always empty otherwise.
    // TODO: Remove these after next release
    #[serde(rename = "payments", default, skip_serializing)]
    payments_on_heap: Vec<UserCanisterStreakInsurancePayment>,
    #[serde(rename = "claims", default, skip_serializing)]
    claims_on_heap: Vec<UserCanisterStreakInsuranceClaim>,
    #[serde(default)]
    payments_count: u32,
    #[serde(default)]
    claims_count: u32,
    utc_offset_mins: i16,
    utc_offset_updates: Vec<(TimestampMillis, i16)>,
}

impl Streak {
    // The most days a user can have insured at once, matching the limit in the UI. The price doubles
    // with each day, so without a limit it overflows, as does the count of days insured.
    pub const MAX_DAYS_INSURED: u8 = 30;

    pub fn days(&self, now: TimestampMillis) -> u16 {
        if let Some(today) = self.timestamp_to_day(now)
            && !self.is_new_streak(today)
        {
            return 1 + self.end_day - self.start_day;
        }

        0
    }

    pub fn set_start_day(&mut self, day: u16) {
        self.start_day = day;
    }

    pub fn set_end_day(&mut self, day: u16) {
        self.end_day = day;
        let streak = 1 + self.end_day - self.start_day;
        if streak > self.max_streak {
            self.max_streak = streak;
        }
    }

    pub fn ends(&self) -> TimestampMillis {
        self.day_to_timestamp(self.end_day + 2)
    }

    pub fn claim(&mut self, now: TimestampMillis) -> Result<Option<UserCanisterStreakInsuranceClaim>, TimestampMillis> {
        if let Some(today) = self.timestamp_to_day(now)
            && today > self.end_day
        {
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

        Err(self.next_claim())
    }

    pub fn claim_via_insurance(&mut self, now: TimestampMillis) -> Option<UserCanisterStreakInsuranceClaim> {
        if !self.has_insurance() {
            return None;
        }

        if let Some(today) = self.timestamp_to_day(now)
            && today == self.end_day + 2
        {
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
            let key = StreakInsuranceKeyPrefix::new_for_claims().create_key(&self.claims_count);
            with_map_mut(|m| m.insert(key, msgpack::serialize_then_unwrap(&claim)));
            self.claims_count += 1;
            info!(day = today, "Streak insurance used");
            return Some(claim);
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
        self.day_to_timestamp_with_offset(day, self.utc_offset_mins)
    }

    pub fn day_to_timestamp_with_offset(&self, day: u16, utc_offset_mins: i16) -> TimestampMillis {
        let utc_offset_ms = mins_to_ms(utc_offset_mins);
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
        let key = StreakInsuranceKeyPrefix::new_for_payments().create_key(&self.payments_count);
        with_map_mut(|m| m.insert(key, msgpack::serialize_then_unwrap(&payment)));
        self.payments_count += 1;
    }

    // Moves the insurance payments and claims which were held on the heap into stable memory,
    // returning how many were moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        let payments = std::mem::take(&mut self.payments_on_heap);
        let claims = std::mem::take(&mut self.claims_on_heap);
        let payments_prefix = StreakInsuranceKeyPrefix::new_for_payments();
        let claims_prefix = StreakInsuranceKeyPrefix::new_for_claims();
        let count = payments.len() + claims.len();

        // Keys are assigned in order, so the entries are inserted in key order
        let payments: Vec<_> = payments
            .iter()
            .map(|payment| {
                let key = payments_prefix.create_key(&self.payments_count);
                self.payments_count += 1;
                (key, msgpack::serialize_then_unwrap(payment))
            })
            .collect();
        let claims: Vec<_> = claims
            .iter()
            .map(|claim| {
                let key = claims_prefix.create_key(&self.claims_count);
                self.claims_count += 1;
                (key, msgpack::serialize_then_unwrap(claim))
            })
            .collect();

        if count > 0 {
            with_map_mut(|m| {
                m.insert_many(payments);
                m.insert_many(claims);
            });
        }
        count
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
            .rfind(|(updated_at, _)| *updated_at < ts)
            .map(|(_, offset)| *offset)
            .unwrap_or_default()
    }

    pub fn reinstate_missed_daily_claims(
        &mut self,
        mut days_to_reinstate: Vec<u16>,
        daily_claims: Vec<TimestampMillis>,
        now: TimestampMillis,
    ) -> Vec<ChitEvent> {
        let now_day = self.timestamp_to_day(now).unwrap();
        let previous_streak = self.days(now);

        let mut daily_claims_map: BTreeMap<_, _> = daily_claims
            .into_iter()
            .flat_map(|ts| Streak::timestamp_to_offset_day(ts, self.utc_offset_mins_at_ts(ts)).map(|d| (d, ts)))
            .collect();

        days_to_reinstate.retain(|day| !daily_claims_map.contains_key(day) && *day <= now_day);

        info!(?days_to_reinstate, "Reinstating daily claims");

        let mut new_events = Vec::new();
        for day in days_to_reinstate {
            let timestamp_of_preceding_claim = daily_claims_map
                .iter()
                .rev()
                .find(|(d, _)| **d < day)
                .map(|(_, ts)| *ts)
                .unwrap_or_default();

            // We use timestamp_of_preceding_claim + 1 because the claim may have updated the utc
            // offset, and we want to use that updated value
            let utc_offset_mins = self.utc_offset_mins_at_ts(timestamp_of_preceding_claim + 1);

            // Calculate the timestamp of the end of the day
            let timestamp = self.day_to_timestamp_with_offset(day, utc_offset_mins) + DAY_IN_MS - 1;
            new_events.push(ChitEvent {
                timestamp,
                reason: ChitEventType::DailyClaimReinstated,
                amount: 0,
            });
            daily_claims_map.insert(day, timestamp);
            info!(day, timestamp, "Daily claim reinstated");
        }

        let end_day = daily_claims_map.keys().next_back().copied().unwrap_or_default();
        let mut start_day = end_day;
        while daily_claims_map.contains_key(&(start_day - 1)) {
            start_day -= 1;
        }

        self.set_start_day(start_day);
        self.set_end_day(end_day);
        let new_streak = self.days(now);
        assert!(new_streak >= previous_streak);

        new_events
    }

    fn is_new_streak(&self, today: u16) -> bool {
        today > (self.end_day + 1)
    }

    fn final_timestamp_of_day(&self, day: u16) -> TimestampMillis {
        self.day_to_timestamp(day) + DAY_IN_MS - 1
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
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::with_map;

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

    #[test]
    fn insurance_payments_and_claims_are_stored_in_stable_memory() {
        init_stable_memory_map();

        let mut now = DAY_ZERO + (60 * DAY_IN_MS);
        let mut streak = Streak::default();
        streak.claim(now).unwrap();
        let payment = payment(now, 1);
        streak.mark_streak_insurance_payment(payment.clone());

        // Miss a day so that the insurance is used
        now += DAY_IN_MS * 2;
        let claim = streak.claim(now).unwrap().unwrap();

        assert_eq!(streak.payments_count, 1);
        assert_eq!(streak.claims_count, 1);
        assert_eq!(payments_in_stable_memory(), to_bytes(&[payment]));
        assert_eq!(claims_in_stable_memory(), to_bytes(&[claim]));
    }

    #[test]
    fn insurance_payments_and_claims_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();

        let payments: Vec<_> = (1..=3).map(|i| payment(DAY_ZERO + i, i as u8)).collect();
        let claims: Vec<_> = (1..=2).map(|i| claim(DAY_ZERO + i, i as u16)).collect();
        let mut streak = Streak {
            payments_on_heap: payments.clone(),
            claims_on_heap: claims.clone(),
            ..Default::default()
        };

        assert_eq!(streak.migrate_to_stable_memory(), 5);
        assert!(streak.payments_on_heap.is_empty());
        assert!(streak.claims_on_heap.is_empty());
        assert_eq!(streak.payments_count, 3);
        assert_eq!(streak.claims_count, 2);

        // New entries are added after those which were migrated
        let new_payment = payment(DAY_ZERO + 10, 4);
        streak.mark_streak_insurance_payment(new_payment.clone());
        let mut expected_payments = payments;
        expected_payments.push(new_payment);

        assert_eq!(payments_in_stable_memory(), to_bytes(&expected_payments));
        assert_eq!(claims_in_stable_memory(), to_bytes(&claims));
        assert_eq!(streak.migrate_to_stable_memory(), 0);
    }

    fn payment(timestamp: TimestampMillis, new_days_insured: u8) -> UserCanisterStreakInsurancePayment {
        UserCanisterStreakInsurancePayment {
            timestamp,
            chat_amount: 100_000_000,
            additional_days: 1,
            new_days_insured,
            transaction_index: timestamp,
        }
    }

    fn claim(timestamp: TimestampMillis, streak_length: u16) -> UserCanisterStreakInsuranceClaim {
        UserCanisterStreakInsuranceClaim {
            timestamp,
            streak_length,
            new_days_claimed: 1,
            insured_days_remaining: 0,
        }
    }

    // The types don't implement PartialEq, so entries are compared by their serialized bytes
    fn to_bytes<T: Serialize>(entries: &[T]) -> Vec<Vec<u8>> {
        entries.iter().map(msgpack::serialize_then_unwrap).collect()
    }

    fn payments_in_stable_memory() -> Vec<Vec<u8>> {
        entries_in_stable_memory(StreakInsuranceKeyPrefix::new_for_payments())
    }

    fn claims_in_stable_memory() -> Vec<Vec<u8>> {
        entries_in_stable_memory(StreakInsuranceKeyPrefix::new_for_claims())
    }

    fn entries_in_stable_memory(prefix: StreakInsuranceKeyPrefix) -> Vec<Vec<u8>> {
        let range = prefix.create_key(&0)..=prefix.create_key(&u32::MAX);
        with_map(|m| m.range(range).map(|(_, v)| v).collect())
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
