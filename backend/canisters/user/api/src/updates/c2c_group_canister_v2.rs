use crate::{EventOrRemoval, GroupCanisterEvent, RemovedFromGroup, merge_in_removals, split_out_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

// Each event is paired with the user it is for, so that a single call can carry the events for
// every user a canister holds
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<(UserId, GroupCanisterEvent)>>,
    // Kept apart from `events`, so that a canister which doesn't know of them ignores them (see
    // `split_out_removals`)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<(UserId, RemovedFromGroup)>>,
}

impl Args {
    pub fn new(events: Vec<IdempotentEnvelope<(UserId, GroupCanisterEvent)>>) -> Args {
        let (events, removals) = split_out_removals(events, |(user_id, event)| match event {
            GroupCanisterEvent::RemovedFromGroup(removal) => EventOrRemoval::Removal((user_id, *removal)),
            event => EventOrRemoval::Event((user_id, event)),
        });
        Args { events, removals }
    }

    pub fn into_events(self) -> Vec<IdempotentEnvelope<(UserId, GroupCanisterEvent)>> {
        merge_in_removals(self.events, self.removals, |(user_id, removal)| {
            (user_id, GroupCanisterEvent::RemovedFromGroup(Box::new(removal)))
        })
    }
}

pub type Response = SuccessOnly;
