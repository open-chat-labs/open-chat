use candid::CandidType;
use rand::distributions::{Distribution, Standard};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::hash::Hash;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[serde(from = "u128")]
pub struct MessageId(u64);

impl MessageId {
    pub fn as_u64(self) -> u64 {
        self.0
    }
}

impl Distribution<MessageId> for Standard {
    fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> MessageId {
        rng.next_u64().into()
    }
}

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value as u64)
    }
}

impl From<u64> for MessageId {
    fn from(value: u64) -> MessageId {
        MessageId(value)
    }
}

impl Display for MessageId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}
