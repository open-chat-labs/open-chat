use candid::CandidType;
use rand::distributions::{Distribution, Standard};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, Eq)]
pub struct MessageId(u128);

impl MessageId {
    pub fn as_u128(self) -> u128 {
        self.0
    }

    pub fn as_u64(self) -> u64 {
        self.0 as u64
    }
}

impl Distribution<MessageId> for Standard {
    fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> MessageId {
        rng.next_u64().into()
    }
}

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value)
    }
}

impl From<u64> for MessageId {
    fn from(value: u64) -> MessageId {
        MessageId(value as u128)
    }
}

impl Display for MessageId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl PartialEq<MessageId> for MessageId {
    fn eq(&self, other: &MessageId) -> bool {
        self.as_u64() == other.as_u64()
    }
}

impl PartialOrd<MessageId> for MessageId {
    fn partial_cmp(&self, other: &MessageId) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for MessageId {
    fn cmp(&self, other: &Self) -> Ordering {
        self.as_u64().cmp(&other.as_u64())
    }
}

impl Hash for MessageId {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.as_u64().hash(state);
    }
}
