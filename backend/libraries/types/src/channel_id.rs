use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use ts_rs::TS;

#[derive(Serialize, Deserialize, CandidType, TS, Clone, Copy, Debug, Eq)]
pub struct ChannelId(u128);

impl Display for ChannelId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<u128> for ChannelId {
    fn from(value: u128) -> Self {
        ChannelId(value)
    }
}

impl From<u32> for ChannelId {
    fn from(value: u32) -> Self {
        ChannelId(value as u128)
    }
}

impl ChannelId {
    pub fn as_u128(self) -> u128 {
        self.0
    }

    pub fn as_u32(self) -> u32 {
        self.0 as u32
    }
}

impl PartialEq<ChannelId> for ChannelId {
    fn eq(&self, other: &ChannelId) -> bool {
        self.as_u32() == other.as_u32()
    }
}

impl PartialOrd<ChannelId> for ChannelId {
    fn partial_cmp(&self, other: &ChannelId) -> Option<Ordering> {
        self.as_u32().partial_cmp(&other.as_u32())
    }
}

impl Ord for ChannelId {
    fn cmp(&self, other: &Self) -> Ordering {
        self.as_u32().cmp(&other.as_u32())
    }
}

impl Hash for ChannelId {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.as_u32().hash(state);
    }
}
