use constants::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS};
use serde::{Deserialize, Serialize};
use std::cmp::max;
use types::{Milliseconds, PinNumberSettings, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct PinNumber {
    value: Timestamped<Option<String>>,
    attempts: Vec<TimestampMillis>,
}

impl PinNumber {
    pub fn set(&mut self, value: Option<String>, now: TimestampMillis) {
        self.value = Timestamped::new(value, now);
        self.attempts.clear();
    }

    pub fn verify(&mut self, attempt: Option<&str>, now: TimestampMillis) -> Result<(), VerifyPinError> {
        if let Some(value) = self.value.as_ref() {
            let delay = self.delay_until_next_attempt(now);
            if delay > 0 {
                return Err(VerifyPinError::TooManyFailedAttempted(delay));
            }

            let Some(attempt) = attempt else {
                return Err(VerifyPinError::PinRequired);
            };

            if attempt != value {
                self.attempts.push(now);
                return Err(VerifyPinError::PinIncorrect(self.delay_until_next_attempt(now)));
            }

            self.attempts.clear();
        }
        Ok(())
    }

    pub fn enabled(&self) -> bool {
        self.value.is_some()
    }

    pub fn delay_until_next_attempt(&self, now: TimestampMillis) -> Milliseconds {
        let delay = match self.attempts.len() {
            x if x < 3 => return 0,
            3 => 5 * MINUTE_IN_MS,
            4 => 15 * MINUTE_IN_MS,
            5 => HOUR_IN_MS,
            _ => DAY_IN_MS,
        };

        let latest = *self.attempts.last().unwrap();
        let blocked_until = latest + delay;
        blocked_until.saturating_sub(now)
    }

    pub fn settings(&self, now: TimestampMillis) -> PinNumberSettings {
        let delay = self.delay_until_next_attempt(now);

        PinNumberSettings {
            length: self.value.as_ref().map(|v| v.len() as u8).unwrap_or_default(),
            attempts_blocked_until: if delay > 0 { Some(now + delay) } else { None },
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        max(self.value.timestamp, self.attempts.last().copied().unwrap_or_default())
    }
}

pub enum VerifyPinError {
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedAttempted(Milliseconds),
}
