use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::CanisterId;

#[derive(Serialize, Deserialize)]
pub struct AuthorizedPrincipals {
    authorizers: HashSet<CanisterId>,
    principals: HashMap<Principal, bool>,
}

impl AuthorizedPrincipals {
    pub fn new(authorizers: HashSet<CanisterId>) -> AuthorizedPrincipals {
        AuthorizedPrincipals {
            authorizers,
            principals: HashMap::new(),
        }
    }

    pub fn add_principal(&mut self, principal: Principal, authorized: bool) {
        self.principals.insert(principal, authorized);
    }

    pub fn is_authorizer(&self, canister_id: &CanisterId) -> bool {
        self.authorizers.contains(canister_id)
    }

    pub fn can_push_notifications(&self, principal: &Principal) -> Option<bool> {
        self.principals.get(principal).copied()
    }
}
