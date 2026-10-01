use crate::{CommunityCanisterEvent, EventOrRemoval, RemovedFromCommunity, merge_in_removals, split_out_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>,
    // Kept apart from `events`, so that a canister which doesn't know of them ignores them (see
    // `split_out_removals`)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<RemovedFromCommunity>>,
}

impl Args {
    pub fn new(user_id: UserId, events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>) -> Args {
        let (events, removals) = split_out_removals(events, |event| match event {
            CommunityCanisterEvent::RemovedFromCommunity(removal) => EventOrRemoval::Removal(*removal),
            event => EventOrRemoval::Event(event),
        });
        Args {
            user_id,
            events,
            removals,
        }
    }

    pub fn into_events(self) -> Vec<IdempotentEnvelope<CommunityCanisterEvent>> {
        merge_in_removals(self.events, self.removals, |removal| {
            CommunityCanisterEvent::RemovedFromCommunity(Box::new(removal))
        })
    }
}

pub type Response = SuccessOnly;
