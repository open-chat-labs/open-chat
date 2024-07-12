use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};
use utils::time::MINUTE_IN_MS;

#[derive(Serialize, Deserialize, Default)]
pub struct IdentityLinkRequests {
    map: HashMap<Principal, IdentityLinkRequest>, // Key is the caller who made the request
}

#[derive(Serialize, Deserialize)]
struct IdentityLinkRequest {
    link_to_principal: Principal,
    originating_canister: CanisterId,
    created: TimestampMillis,
}

impl IdentityLinkRequests {
    pub fn push(
        &mut self,
        caller: Principal,
        originating_canister: CanisterId,
        link_to_principal: Principal,
        now: TimestampMillis,
    ) {
        self.prune_expired(now);

        self.map.insert(
            caller,
            IdentityLinkRequest {
                link_to_principal,
                originating_canister,
                created: now,
            },
        );
    }

    pub fn take(&mut self, caller: Principal, link_initiated_by: Principal, now: TimestampMillis) -> Option<CanisterId> {
        self.prune_expired(now);

        if let Occupied(e) = self.map.entry(link_initiated_by) {
            let entry = e.get();
            if entry.link_to_principal == caller {
                let originating_canister = entry.originating_canister;
                e.remove();
                return Some(originating_canister);
            }
        }

        None
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        let cutoff = now.saturating_sub(5 * MINUTE_IN_MS);
        self.map.retain(|_, v| v.created > cutoff)
    }
}
