use candid::CandidType;
use rand::distributions::{Distribution, Standard};
use rand::Rng;
use std::cmp::Ordering;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Debug, Default, Clone, Copy, Eq)]
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

    pub(super) struct MessageIdVisitor;

    impl serde::de::Visitor<'_> for MessageIdVisitor {
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
