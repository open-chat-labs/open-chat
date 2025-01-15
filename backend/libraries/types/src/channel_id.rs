use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_rs::TS;

#[derive(Serialize, Deserialize, CandidType, TS, Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[serde(from = "u128")]
pub struct ChannelId(u32);

impl Display for ChannelId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<u128> for ChannelId {
    fn from(value: u128) -> Self {
        ChannelId(value as u32)
    }
}

impl From<u32> for ChannelId {
    fn from(value: u32) -> Self {
        ChannelId(value)
    }
}

impl ChannelId {
    pub fn as_u32(self) -> u32 {
        self.0
    }
}
