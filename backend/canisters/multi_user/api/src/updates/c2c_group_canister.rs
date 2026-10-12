use crate::{GroupCanisterEvent, RemovedFromGroup, merge_in_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<IdempotentEnvelope<GroupCanisterEvent>>,
    // Removals sent apart from `events` by Group and Community canisters on 2.0.2088 and 2.0.2087,
    // which are put back among the other events (see `merge_in_removals`)
    // TODO: Remove once every Group and Community canister sends them among the other events
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<RemovedFromGroup>>,
}

impl Args {
    pub fn new(user_id: UserId, events: Vec<IdempotentEnvelope<GroupCanisterEvent>>) -> Args {
        Args {
            user_id,
            events,
            removals: Vec::new(),
        }
    }

    pub fn into_events(self) -> Vec<IdempotentEnvelope<GroupCanisterEvent>> {
        merge_in_removals(self.events, self.removals, |removal| {
            GroupCanisterEvent::RemovedFromGroup(Box::new(removal))
        })
    }
}

pub type Response = SuccessOnly;

#[cfg(test)]
mod tests {
    use super::*;
    use ic_principal::Principal;
    use types::Achievement;

    fn envelope(id: u64, value: GroupCanisterEvent) -> IdempotentEnvelope<GroupCanisterEvent> {
        IdempotentEnvelope {
            created_at: id * 10,
            idempotency_id: id,
            value,
        }
    }

    fn removal(id: u64) -> IdempotentEnvelope<RemovedFromGroup> {
        IdempotentEnvelope {
            created_at: id * 10,
            idempotency_id: id,
            value: RemovedFromGroup {
                removed_by: Principal::from_slice(&[2]).into(),
                blocked: true,
                group_name: "group".to_string(),
                public: false,
            },
        }
    }

    fn user_id() -> UserId {
        Principal::from_slice(&[1]).into()
    }

    #[test]
    fn removals_are_sent_among_the_other_events() {
        let events = vec![
            envelope(1, GroupCanisterEvent::Achievement(Achievement::JoinedGroup)),
            envelope(2, GroupCanisterEvent::RemovedFromGroup(Box::new(removal(2).value))),
        ];
        let bytes = msgpack::serialize_then_unwrap(Args::new(user_id(), events));
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.removals.is_empty());
        let ids: Vec<_> = args.into_events().iter().map(|event| event.idempotency_id).collect();
        assert_eq!(ids, vec![1, 2]);
    }

    #[test]
    fn removals_sent_apart_are_put_back_among_the_other_events_in_order() {
        let args = Args {
            user_id: user_id(),
            events: vec![
                envelope(1, GroupCanisterEvent::Achievement(Achievement::JoinedGroup)),
                envelope(3, GroupCanisterEvent::Achievement(Achievement::SentImage)),
            ],
            removals: vec![removal(2)],
        };
        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(args));
        let events = args.into_events();
        let ids: Vec<_> = events.iter().map(|event| event.idempotency_id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
        assert!(matches!(&events[1].value, GroupCanisterEvent::RemovedFromGroup(removal) if removal.blocked));
    }
}
