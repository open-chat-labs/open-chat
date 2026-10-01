use crate::{EventOrRemoval, GroupCanisterEvent, RemovedFromGroup, merge_in_removals, split_out_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<IdempotentEnvelope<GroupCanisterEvent>>,
    // Kept apart from `events`, so that a canister which doesn't know of them ignores them (see
    // `split_out_removals`)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<RemovedFromGroup>>,
}

impl Args {
    pub fn new(user_id: UserId, events: Vec<IdempotentEnvelope<GroupCanisterEvent>>) -> Args {
        let (events, removals) = split_out_removals(events, |event| match event {
            GroupCanisterEvent::RemovedFromGroup(removal) => EventOrRemoval::Removal(*removal),
            event => EventOrRemoval::Event(event),
        });
        Args {
            user_id,
            events,
            removals,
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
    use crate::{MessageActivityEvent, P2PSwapCreated};
    use ic_principal::Principal;
    use types::Achievement;

    // The args as a User canister on the previous version reads them
    #[derive(Deserialize)]
    struct PreviousArgs {
        #[expect(dead_code)]
        user_id: UserId,
        events: Vec<IdempotentEnvelope<PreviousGroupCanisterEvent>>,
    }

    #[derive(Deserialize)]
    #[expect(dead_code)]
    enum PreviousGroupCanisterEvent {
        MessageActivity(MessageActivityEvent),
        Achievement(Achievement),
        P2PSwapCreated(Box<P2PSwapCreated>),
    }

    fn envelope(id: u64, value: GroupCanisterEvent) -> IdempotentEnvelope<GroupCanisterEvent> {
        IdempotentEnvelope {
            created_at: id * 10,
            idempotency_id: id,
            value,
        }
    }

    fn events() -> Vec<IdempotentEnvelope<GroupCanisterEvent>> {
        vec![
            envelope(1, GroupCanisterEvent::Achievement(Achievement::JoinedGroup)),
            envelope(
                2,
                GroupCanisterEvent::RemovedFromGroup(Box::new(RemovedFromGroup {
                    removed_by: Principal::from_slice(&[2]).into(),
                    blocked: true,
                    group_name: "group".to_string(),
                    public: false,
                })),
            ),
            envelope(3, GroupCanisterEvent::Achievement(Achievement::SentImage)),
        ]
    }

    fn user_id() -> UserId {
        Principal::from_slice(&[1]).into()
    }

    #[test]
    fn previous_version_reads_the_other_events_and_ignores_removals() {
        let bytes = msgpack::serialize_then_unwrap(Args::new(user_id(), events()));
        let args: PreviousArgs = msgpack::deserialize_then_unwrap(&bytes);
        let ids: Vec<_> = args.events.iter().map(|event| event.idempotency_id).collect();
        assert_eq!(ids, vec![1, 3]);
    }

    #[test]
    fn previous_version_fails_to_read_a_removal_among_the_other_events() {
        let bytes = msgpack::serialize_then_unwrap(Args {
            user_id: user_id(),
            events: events(),
            removals: Vec::new(),
        });
        assert!(msgpack::deserialize::<PreviousArgs, _>(bytes.as_slice()).is_err());
    }

    #[test]
    fn removals_are_put_back_among_the_other_events_in_order() {
        let bytes = msgpack::serialize_then_unwrap(Args::new(user_id(), events()));
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(args.removals.len(), 1);
        let events = args.into_events();
        let ids: Vec<_> = events.iter().map(|event| event.idempotency_id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
        assert!(matches!(&events[1].value, GroupCanisterEvent::RemovedFromGroup(removal) if removal.blocked));
    }

    #[test]
    fn args_without_removals_are_read_by_either_version() {
        let events = vec![envelope(1, GroupCanisterEvent::Achievement(Achievement::JoinedGroup))];
        let bytes = msgpack::serialize_then_unwrap(Args::new(user_id(), events));
        let args: PreviousArgs = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(args.events.len(), 1);
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.removals.is_empty());
    }
}
