use crate::{CanisterId, TimestampMillis, UserId};
use serde::de::value::MapAccessDeserializer;
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::marker::PhantomData;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IdempotentEnvelope<T> {
    pub created_at: TimestampMillis,
    pub idempotency_id: u64,
    pub value: T,
}

// Temp hack to allow us to release this in a non-breaking way
impl<T> From<T> for IdempotentEnvelope<T> {
    fn from(value: T) -> Self {
        IdempotentEnvelope {
            created_at: 0,
            idempotency_id: 0,
            value,
        }
    }
}

// An event queued to be sent to the canister which holds a user, paired with that user, so that
// the events for every user a canister holds can be queued, and sent, together.
//
// Events queued before they were paired with their user deserialize as `Unpaired`. Those were
// queued against a User canister's user, whose id is the id of that canister, which is how the
// queue was then keyed, so `user_id` takes it from there.
// TODO: Remove `Unpaired` once every queue holding them has been drained
//
// It isn't `#[serde(untagged)]`, since that buffers the input before trying each variant, which
// fails for values which aren't self describing (eg. a u128 in msgpack). Instead it is told apart
// by its shape: `Paired` is serialized as a 2 element sequence, whereas an envelope is a map.
#[derive(Clone, Debug)]
pub enum QueuedUserEvent<T> {
    Paired(UserId, IdempotentEnvelope<T>),
    Unpaired(IdempotentEnvelope<T>),
}

impl<T: Serialize> Serialize for QueuedUserEvent<T> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            QueuedUserEvent::Paired(user_id, event) => (user_id, event).serialize(serializer),
            QueuedUserEvent::Unpaired(event) => event.serialize(serializer),
        }
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for QueuedUserEvent<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct QueuedUserEventVisitor<T>(PhantomData<T>);

        impl<'de, T: Deserialize<'de>> Visitor<'de> for QueuedUserEventVisitor<T> {
            type Value = QueuedUserEvent<T>;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a (user id, event) pair or an event")
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
                let user_id = seq.next_element()?.ok_or_else(|| de::Error::invalid_length(0, &self))?;
                let event = seq.next_element()?.ok_or_else(|| de::Error::invalid_length(1, &self))?;
                Ok(QueuedUserEvent::Paired(user_id, event))
            }

            fn visit_map<A: MapAccess<'de>>(self, map: A) -> Result<Self::Value, A::Error> {
                IdempotentEnvelope::deserialize(MapAccessDeserializer::new(map)).map(QueuedUserEvent::Unpaired)
            }
        }

        deserializer.deserialize_any(QueuedUserEventVisitor(PhantomData))
    }
}

impl<T> QueuedUserEvent<T> {
    pub fn new(user_id: UserId, event: IdempotentEnvelope<T>) -> Self {
        QueuedUserEvent::Paired(user_id, event)
    }

    // The user the event is for, given the canister it was queued to be sent to
    pub fn user_id(&self, canister_id: CanisterId) -> UserId {
        match self {
            QueuedUserEvent::Paired(user_id, _) => *user_id,
            QueuedUserEvent::Unpaired(_) => canister_id.into(),
        }
    }

    pub fn into_parts(self, canister_id: CanisterId) -> (UserId, IdempotentEnvelope<T>) {
        match self {
            QueuedUserEvent::Paired(user_id, event) => (user_id, event),
            QueuedUserEvent::Unpaired(event) => (canister_id.into(), event),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{BTreeMap, VecDeque};

    fn envelope(idempotency_id: u64) -> IdempotentEnvelope<String> {
        IdempotentEnvelope {
            created_at: 1,
            idempotency_id,
            value: idempotency_id.to_string(),
        }
    }

    fn canister_id() -> CanisterId {
        CanisterId::from_text("dfdal-2uaaa-aaaaa-qaama-cai").unwrap()
    }

    #[test]
    fn paired_events_round_trip() {
        let user_id = UserId::new_indexed(canister_id(), 3);
        let bytes = msgpack::serialize_then_unwrap(QueuedUserEvent::new(user_id, envelope(7)));
        let event: QueuedUserEvent<String> = msgpack::deserialize_then_unwrap(&bytes);

        assert!(matches!(&event, QueuedUserEvent::Paired(u, e) if *u == user_id && e.idempotency_id == 7));
        assert_eq!(event.user_id(canister_id()), user_id);
    }

    // A queue as persisted before events were paired with their user, keyed by the user id of each
    // User canister's user, reads back keyed by canister id, with each event for that user
    #[test]
    fn queues_persisted_before_pairing_read_back_keyed_by_canister() {
        let user_id: UserId = canister_id().into();
        let old: BTreeMap<UserId, VecDeque<IdempotentEnvelope<String>>> =
            BTreeMap::from([(user_id, VecDeque::from([envelope(1), envelope(2)]))]);

        let new: BTreeMap<CanisterId, VecDeque<QueuedUserEvent<String>>> =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&old));

        let events = &new[&canister_id()];
        assert_eq!(events.len(), 2);
        for (i, event) in events.iter().enumerate() {
            assert!(matches!(event, QueuedUserEvent::Unpaired(e) if e.idempotency_id == i as u64 + 1));
            assert_eq!(event.user_id(canister_id()), user_id);
        }
    }

    #[test]
    fn events_with_non_self_describing_values_round_trip() {
        #[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
        struct Awkward {
            amount: u128,
            #[serde(with = "serde_bytes")]
            bytes: Vec<u8>,
            principal: CanisterId,
            nested: Option<Box<Awkward>>,
        }
        let value = Awkward {
            amount: u128::MAX,
            bytes: vec![1, 2, 3],
            principal: canister_id(),
            nested: Some(Box::new(Awkward {
                amount: 5,
                bytes: Vec::new(),
                principal: canister_id(),
                nested: None,
            })),
        };
        let event = IdempotentEnvelope {
            created_at: 1,
            idempotency_id: 2,
            value: value.clone(),
        };

        let paired: QueuedUserEvent<Awkward> = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(
            QueuedUserEvent::new(canister_id().into(), event.clone()),
        ));
        assert!(matches!(paired, QueuedUserEvent::Paired(_, e) if e.value == value));

        let unpaired: QueuedUserEvent<Awkward> = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(event));
        assert!(matches!(unpaired, QueuedUserEvent::Unpaired(e) if e.value == value));
    }
}
