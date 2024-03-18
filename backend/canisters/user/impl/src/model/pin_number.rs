use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{Milliseconds, TimestampMillis, Timestamped};
use user_canister::initial_state::PinNumberSettings;
use utils::time::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS};

#[derive(Serialize, Deserialize, Default)]
pub struct PinNumber {
    value: Timestamped<Option<Vec<u8>>>,
    attempts: Vec<TimestampMillis>,
}

impl PinNumber {
    pub fn set(&mut self, value: Option<Vec<u8>>, now: TimestampMillis) {
        self.value = Timestamped::new(value, now);
        self.attempts.clear();
    }

    pub fn verify(&mut self, attempt: Option<&[u8]>, now: TimestampMillis) -> Result<(), VerifyPinError> {
        if let Some(value) = self.value.value.as_ref() {
            if let Some(delay) = self.delay_until_next_attempt(now) {
                return Err(VerifyPinError::TooManyFailedAttempted(delay));
            }

            let Some(attempt) = attempt else {
                return Err(VerifyPinError::PinRequired);
            };

            if attempt != value.as_slice() {
                self.attempts.push(now);
                return Err(VerifyPinError::PinIncorrect(self.delay_until_next_attempt(now)));
            }

            self.attempts.clear();
        }
        Ok(())
    }

    pub fn delay_until_next_attempt(&self, now: TimestampMillis) -> Option<Milliseconds> {
        let delay = match self.attempts.len() {
            x if x < 3 => return None,
            3 => 5 * MINUTE_IN_MS,
            4 => 15 * MINUTE_IN_MS,
            5 => HOUR_IN_MS,
            _ => DAY_IN_MS,
        };

        let latest = *self.attempts.last().unwrap();
        let blocked_until = latest + delay;
        blocked_until.checked_sub(now)
    }

    pub fn settings(&self, now: TimestampMillis) -> PinNumberSettings {
        PinNumberSettings {
            enabled: self.value.value.is_some(),
            attempts_blocked_until: self.delay_until_next_attempt(now).map(|d| now + d),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        max(self.value.timestamp, self.attempts.last().copied().unwrap_or_default())
    }
}

pub enum VerifyPinError {
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedAttempted(Milliseconds),
}
