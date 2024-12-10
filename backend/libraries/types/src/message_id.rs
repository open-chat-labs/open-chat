use candid::CandidType;
use rand::distributions::{Distribution, Standard};
use rand::Rng;
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

impl Distribution<MessageId> for Standard {
    fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> MessageId {
        MessageId(rng.gen())
    }
}

impl From<u128> for MessageId {
    fn from(value: u128) -> MessageId {
        MessageId(value)
    }
}

impl Display for MessageId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

// Serialization
impl serde::Serialize for MessageId {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        if serializer.is_human_readable() {
            serializer.serialize_str(&self.0.to_string())
        } else {
            serializer.serialize_u128(self.0)
        }
    }
}

// Deserialization
mod deserialize {
    use super::MessageId;

    // Simple visitor for deserialization from bytes. We don't support other number types
    // as there's no need for it.
    pub(super) struct MessageIdVisitor;

    impl<'de> serde::de::Visitor<'de> for MessageIdVisitor {
        type Value = super::MessageId;

        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str("u128 or string")
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let value = v.parse().map_err(E::custom)?;
            Ok(MessageId(value))
        }

        fn visit_u128<E>(self, v: u128) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(MessageId(v))
        }
    }
}

impl<'de> serde::Deserialize<'de> for MessageId {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<MessageId, D::Error> {
        use serde::de::Error;
        if deserializer.is_human_readable() {
            deserializer
                .deserialize_str(deserialize::MessageIdVisitor)
                .map_err(D::Error::custom)
        } else {
            deserializer.deserialize_u128(deserialize::MessageIdVisitor)
        }
    }
}
