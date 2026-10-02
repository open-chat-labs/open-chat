use crate::{CommunityCanisterEvent, RemovedFromCommunity, merge_in_removals};
use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>,
    // Removals sent apart from `events` by Group and Community canisters on 2.0.2088 and 2.0.2087,
    // which are put back among the other events (see `merge_in_removals`)
    // TODO: Remove once every Group and Community canister sends them among the other events
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub removals: Vec<IdempotentEnvelope<RemovedFromCommunity>>,
}

impl Args {
    pub fn new(user_id: UserId, events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>) -> Args {
        Args {
            user_id,
            events,
            removals: Vec::new(),
        }
    }

    pub fn into_events(self) -> Vec<IdempotentEnvelope<CommunityCanisterEvent>> {
        merge_in_removals(self.events, self.removals, |removal| {
            CommunityCanisterEvent::RemovedFromCommunity(Box::new(removal))
        })
    }
}

pub type Response = SuccessOnly;
