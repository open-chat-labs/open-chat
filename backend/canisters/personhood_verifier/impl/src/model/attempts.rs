use serde::{Deserialize, Serialize};
use types::TimestampMillis;

use constants::HOUR_IN_MS;

pub const MAX_ATTEMPTS_PER_WINDOW: usize = 5;
pub const ATTEMPT_WINDOW: u64 = 48 * HOUR_IN_MS;
pub const RETRY_WINDOW: u64 = HOUR_IN_MS;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct AttemptHistory {
    pub attempts: Vec<TimestampMillis>,
    // Set when a scan came back inconclusive: one stricter retry round is
    // permitted (without burning another attempt) until this deadline
    pub retry_permitted_until: Option<TimestampMillis>,
}

impl AttemptHistory {
    pub fn prune(&mut self, now: TimestampMillis) {
        self.attempts.retain(|&t| t + ATTEMPT_WINDOW > now);
    }

    pub fn attempts_remaining(&self, now: TimestampMillis) -> usize {
        MAX_ATTEMPTS_PER_WINDOW.saturating_sub(self.attempts.iter().filter(|&&t| t + ATTEMPT_WINDOW > now).count())
    }

    pub fn next_attempt_at(&self, now: TimestampMillis) -> TimestampMillis {
        self.attempts
            .iter()
            .filter(|&&t| t + ATTEMPT_WINDOW > now)
            .min()
            .map_or(now, |&t| t + ATTEMPT_WINDOW)
    }

    pub fn retry_round_available(&self, now: TimestampMillis) -> bool {
        self.retry_permitted_until.is_some_and(|until| until > now)
    }

    pub fn record_attempt(&mut self, now: TimestampMillis) {
        self.attempts.push(now);
        self.retry_permitted_until = None;
    }

    pub fn permit_retry(&mut self, now: TimestampMillis) {
        self.retry_permitted_until = Some(now + RETRY_WINDOW);
    }
}
