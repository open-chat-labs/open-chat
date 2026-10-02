use crate::{CommunityCanisterEvent, RemovedFromCommunity, merge_in_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

// Each event is paired with the user it is for, so that a single call can carry the events for
// every user a canister holds
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<(UserId, CommunityCanisterEvent)>>,
    // Removals sent apart from `events` by Group and Community canisters on 2.0.2088 and 2.0.2087,
    // which are put back among the other events (see `merge_in_removals`)
    // TODO: Remove once every Group and Community canister sends them among the other events
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<(UserId, RemovedFromCommunity)>>,
}

impl Args {
    pub fn new(events: Vec<IdempotentEnvelope<(UserId, CommunityCanisterEvent)>>) -> Args {
        Args {
            events,
            removals: Vec::new(),
        }
    }

    pub fn into_events(self) -> Vec<IdempotentEnvelope<(UserId, CommunityCanisterEvent)>> {
        merge_in_removals(self.events, self.removals, |(user_id, removal)| {
            (user_id, CommunityCanisterEvent::RemovedFromCommunity(Box::new(removal)))
        })
    }
}

pub type Response = SuccessOnly;
