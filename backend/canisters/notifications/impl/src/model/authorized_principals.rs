use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Serialize, Deserialize, Default)]
pub struct AuthorizedPrincipals {
    authorized: HashSet<Principal>,
    blocked: HashSet<Principal>,
}

impl AuthorizedPrincipals {
    pub fn add_principal(&mut self, principal: Principal, authorized: bool) {
        if authorized {
            self.authorized.insert(principal);
        } else {
            self.blocked.insert(principal);
        }
    }

    pub fn can_push_notifications(&self, principal: &Principal) -> Option<bool> {
        if self.authorized.contains(principal) {
            Some(true)
        } else if self.blocked.contains(principal) {
            Some(false)
        } else {
            None
        }
    }

    pub fn count_authorized(&self) -> usize {
        self.authorized.len()
    }

    pub fn count_blocked(&self) -> usize {
        self.blocked.len()
    }
}
