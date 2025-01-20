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
        formatter.write_str("a positive integer")
    }

    fn visit_i64<E: Error>(self, v: i64) -> Result<Self::Value, E> {
        self.visit_i128(v as i128)
    }

    fn visit_i128<E: Error>(self, v: i128) -> Result<Self::Value, E> {
        match u128::try_from(v) {
            Ok(v) => self.visit_u128(v),
            Err(_) => Err(E::custom(format!("MessageId cannot be negative: {}", v))),
        }
    }

    fn visit_u64<E: Error>(self, v: u64) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_u128<E: Error>(self, v: u128) -> Result<Self::Value, E> {
        Ok(v.into())
    }

    fn visit_str<E: Error>(self, v: &str) -> Result<Self::Value, E> {
        match u128::from_str(v) {
            Ok(value) => Ok(value.into()),
            Err(error) => Err(E::custom(format!("invalid message id: {v}. Error: {error}"))),
        }
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

#[test]
fn serde() {
    let mut bytes = Vec::new();
    let mut ser = rmp_serde::Serializer::new(&mut bytes)
        .with_struct_map()
        .with_large_ints_as_strings();

    u128::MAX.serialize(&mut ser).unwrap();

    let blah: MessageId = rmp_serde::from_slice(&bytes).unwrap();
}
