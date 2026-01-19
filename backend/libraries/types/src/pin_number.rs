use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PinNumberSettings {
    pub length: u8,
    pub attempts_blocked_until: Option<TimestampMillis>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone)]
#[serde(transparent)]
pub struct PinNumberWrapper(String);

const PIN_MASK: &str = "******";

impl PinNumberWrapper {
    pub fn consume(&mut self) -> String {
        std::mem::take(&mut self.0)
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl Debug for PinNumberWrapper {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(PIN_MASK)
    }
}

impl From<String> for PinNumberWrapper {
    fn from(value: String) -> Self {
        PinNumberWrapper(value)
    }
}
