use candid::Principal;
use constants::MINUTE_IN_MS;
use identity_canister::WebAuthnKey;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Occupied;
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct IdentityLinkRequests {
    map: HashMap<Principal, IdentityLinkRequest>, // Key is the caller who made the request
}

#[derive(Serialize, Deserialize)]
pub struct IdentityLinkRequest {
    pub webauthn_key: Option<WebAuthnKey>,
    pub link_to_principal: Principal,
    pub originating_canister: CanisterId,
    #[serde(default)]
    pub is_ii_principal: bool,
    pub created: TimestampMillis,
}

impl IdentityLinkRequests {
    pub fn push(
        &mut self,
        auth_principal: Principal,
        webauthn_key: Option<WebAuthnKey>,
        originating_canister: CanisterId,
        is_ii_principal: bool,
        link_to_principal: Principal,
        now: TimestampMillis,
    ) {
        self.prune_expired(now);

        self.map.insert(
            auth_principal,
            IdentityLinkRequest {
                webauthn_key,
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
    ) -> Option<IdentityLinkRequest> {
        self.prune_expired(now);

        if let Occupied(e) = self.map.entry(link_initiated_by) {
            if e.get().link_to_principal == caller {
                return Some(e.remove());
            }
        }

        None
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        let cutoff = now.saturating_sub(5 * MINUTE_IN_MS);
        self.map.retain(|_, v| v.created > cutoff)
    }
}
