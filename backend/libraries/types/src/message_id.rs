use candid::CandidType;
use rand::distributions::{Distribution, Standard};
use rand::Rng;
use serde::de::{Error, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::{Display, Formatter};
use std::hash::Hash;
use std::str::FromStr;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Debug, Default, Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Hash)]
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

struct MessageIdVisitor;

impl Visitor<'_> for MessageIdVisitor {
    type Value = MessageId;

    fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
        formatter.write_str("a u64, u128 or string")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: Error,
    {
        match u128::from_str(v) {
            Ok(value) => Ok(value.into()),
            Err(error) => Err(E::custom(format!("invalid message id: {v}. Error: {error}"))),
        }
    }

    fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_u128<E>(self, v: u128) -> Result<Self::Value, E> {
        Ok(v.into())
    }
}

impl<'de> Deserialize<'de> for MessageId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(MessageIdVisitor)
    }
}
