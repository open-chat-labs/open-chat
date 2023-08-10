use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::CanisterId;

#[derive(Serialize, Deserialize)]
#[serde(from = "AuthorizedPrincipalsPrevious")]
pub struct AuthorizedPrincipals {
    authorizers: HashSet<CanisterId>,
    authorized: HashSet<Principal>,
    blocked: HashSet<Principal>,
}

#[derive(Serialize, Deserialize)]
pub struct AuthorizedPrincipalsPrevious {
    authorizers: HashSet<CanisterId>,
    principals: HashMap<Principal, bool>,
}

impl AuthorizedPrincipals {
    pub fn new(authorizers: HashSet<CanisterId>) -> AuthorizedPrincipals {
        AuthorizedPrincipals {
            authorizers,
            authorized: HashSet::new(),
            blocked: HashSet::new(),
        }
    }

    pub fn add_principal(&mut self, principal: Principal, authorized: bool) {
        if authorized {
            self.authorized.insert(principal);
        } else {
            self.blocked.insert(principal);
        }
    }

    pub fn is_authorizer(&self, canister_id: &CanisterId) -> bool {
        self.authorizers.contains(canister_id)
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

impl From<AuthorizedPrincipalsPrevious> for AuthorizedPrincipals {
    fn from(value: AuthorizedPrincipalsPrevious) -> Self {
        let mut authorized = HashSet::new();
        let mut blocked = HashSet::new();

        for (principal, is_authorized) in value.principals {
            if is_authorized {
                authorized.insert(principal);
            } else {
                blocked.insert(principal);
            }
        }

        AuthorizedPrincipals {
            authorizers: value.authorizers,
            authorized,
            blocked,
        }
    }
}
