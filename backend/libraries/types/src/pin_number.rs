use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use std::ops::Deref;
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

impl Debug for PinNumberWrapper {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str("********")
    }
}

impl From<PinNumberWrapper> for String {
    fn from(value: PinNumberWrapper) -> Self {
        value.0
    }
}

impl Deref for PinNumberWrapper {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
