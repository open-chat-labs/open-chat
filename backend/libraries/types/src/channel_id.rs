use candid::CandidType;
use serde::de::{Error, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use ts_rs::TS;

#[derive(Serialize, CandidType, TS, Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
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

struct ChannelIdVisitor;

impl Visitor<'_> for ChannelIdVisitor {
    type Value = ChannelId;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a u32, u128 or string")
    }

    fn visit_u32<E>(self, v: u32) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_u128<E>(self, v: u128) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: Error,
    {
        match u128::from_str(v) {
            Ok(value) => Ok(value.into()),
            Err(error) => Err(E::custom(format!("invalid channel id: {v}. Error: {error}"))),
        }
    }
}

impl<'de> Deserialize<'de> for ChannelId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(ChannelIdVisitor)
    }
}
