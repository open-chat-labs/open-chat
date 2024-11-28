use candid::Principal;
use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct IdentityLinkRequests {
    map: HashMap<Principal, IdentityLinkRequest>, // Key is the caller who made the request
}

#[derive(Serialize, Deserialize)]
struct IdentityLinkRequest {
    link_to_principal: Principal,
    originating_canister: CanisterId,
    #[serde(default)]
    is_ii_principal: bool,
    created: TimestampMillis,
}

impl IdentityLinkRequests {
    pub fn push(
        &mut self,
        caller: Principal,
        originating_canister: CanisterId,
        is_ii_principal: bool,
        link_to_principal: Principal,
        now: TimestampMillis,
    ) {
        self.prune_expired(now);

        self.map.insert(
            caller,
            IdentityLinkRequest {
                link_to_principal,
                originating_canister,
                is_ii_principal,
                created: now,
            },
        );
    }

    pub fn take(
        &mut self,
        caller: Principal,
        link_initiated_by: Principal,
        now: TimestampMillis,
    ) -> Option<(CanisterId, bool)> {
        self.prune_expired(now);

        if let Occupied(e) = self.map.entry(link_initiated_by) {
            let entry = e.get();
            if entry.link_to_principal == caller {
                let originating_canister = entry.originating_canister;
                let is_ii_principal = entry.is_ii_principal;
                e.remove();
                return Some((originating_canister, is_ii_principal));
            }
        }

        None
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        let cutoff = now.saturating_sub(5 * MINUTE_IN_MS);
        self.map.retain(|_, v| v.created > cutoff)
    }
}
