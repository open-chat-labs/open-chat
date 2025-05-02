use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct IdentityLinkViaQrCodeRequests {
    map: HashMap<u128, IdentityLinkViaQrCodeRequest>,
}

#[derive(Serialize, Deserialize)]
pub struct IdentityLinkViaQrCodeRequest {
    pub user_principal_index: u32,
    pub created: TimestampMillis,
}

impl IdentityLinkViaQrCodeRequests {
    pub fn push(&mut self, link_code: u128, user_principal_index: u32, now: TimestampMillis) {
        self.prune_expired(now);

        self.map.insert(
            link_code,
            IdentityLinkViaQrCodeRequest {
                user_principal_index,
                created: now,
            },
        );
    }

    pub fn take(&mut self, link_code: u128, now: TimestampMillis) -> Option<IdentityLinkViaQrCodeRequest> {
        self.prune_expired(now);
        self.map.remove(&link_code)
    }

    fn prune_expired(&mut self, now: TimestampMillis) {
        let cutoff = now.saturating_sub(5 * MINUTE_IN_MS);
        self.map.retain(|_, v| v.created > cutoff)
    }
}
