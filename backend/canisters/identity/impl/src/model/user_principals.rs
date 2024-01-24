use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipals {
    user_principals: HashMap<u32, UserPrincipal>,
    principal_to_index: HashMap<Principal, u32>,
}

#[derive(Serialize, Deserialize)]
pub struct UserPrincipal {
    pub index: u32,
    pub principal: Principal,
    pub auth_principals: Vec<Principal>,
}

impl UserPrincipals {
    #[allow(dead_code)]
    pub fn push(&mut self, index: u32, principal: Principal, auth_principal: Principal) {
        assert!(!self.user_principals.contains_key(&index));
        assert!(!self.principal_to_index.contains_key(&auth_principal));

        self.user_principals.insert(
            index,
            UserPrincipal {
                index,
                principal,
                auth_principals: vec![auth_principal],
            },
        );
        self.principal_to_index.insert(auth_principal, index);
    }

    pub fn get(&self, principal: &Principal) -> Option<&UserPrincipal> {
        self.principal_to_index
            .get(principal)
            .and_then(|id| self.user_principals.get(id))
    }
}
