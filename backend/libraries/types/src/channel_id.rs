use candid::CandidType;
use serde::de::{Error, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use ts_export::ts_export;

#[ts_export]
#[derive(Serialize, CandidType, Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
#[ts(as = "u128")]
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
        formatter.write_str("a positive integer")
    }

    fn visit_i8<E: Error>(self, v: i8) -> Result<Self::Value, E> {
        self.visit_i32(v.into())
    }

    fn visit_i16<E: Error>(self, v: i16) -> Result<Self::Value, E> {
        self.visit_i32(v.into())
    }

    fn visit_i32<E: Error>(self, v: i32) -> Result<Self::Value, E> {
        match u32::try_from(v) {
            Ok(v) => self.visit_u32(v),
            Err(_) => Err(E::custom(format!("ChannelId cannot be negative: {v}"))),
        }
    }

    fn visit_i64<E: Error>(self, v: i64) -> Result<Self::Value, E> {
        self.visit_i128(v.into())
    }

    fn visit_i128<E: Error>(self, v: i128) -> Result<Self::Value, E> {
        match u128::try_from(v) {
            Ok(v) => self.visit_u128(v),
            Err(_) => Err(E::custom(format!("ChannelId cannot be negative: {v}"))),
        }
    }

    fn visit_u8<E: Error>(self, v: u8) -> Result<Self::Value, E> {
        self.visit_u64(v.into())
    }

    fn visit_u16<E: Error>(self, v: u16) -> Result<Self::Value, E> {
        self.visit_u64(v.into())
    }

    fn visit_u32<E: Error>(self, v: u32) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_u64<E: Error>(self, v: u64) -> Result<Self::Value, E> {
        self.visit_u128(v.into())
    }

    fn visit_u128<E: Error>(self, v: u128) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_str<E: Error>(self, v: &str) -> Result<Self::Value, E> {
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
