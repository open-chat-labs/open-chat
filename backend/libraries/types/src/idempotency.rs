use crate::{CanisterId, TimestampMillis, UserId};
use serde::{Deserialize, Serialize};

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
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum QueuedUserEvent<T> {
    Paired(UserId, IdempotentEnvelope<T>),
    Unpaired(IdempotentEnvelope<T>),
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
}
