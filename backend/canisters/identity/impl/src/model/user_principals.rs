use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ops::Index;

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipals {
    user_principals: Vec<UserPrincipal>,
    auth_principal_to_index: HashMap<Principal, u32>,
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
        assert_eq!(self.user_principals.len(), index as usize);
        assert!(!self.auth_principal_to_index.contains_key(&auth_principal));

        self.user_principals.push(UserPrincipal {
            index,
            principal,
            auth_principals: vec![auth_principal],
        });
        self.auth_principal_to_index.insert(auth_principal, index);
    }

    pub fn get_by_auth_principal(&self, auth_principal: &Principal) -> Option<&UserPrincipal> {
        self.auth_principal_to_index
            .get(auth_principal)
            .map(|id| self.user_principals.index(*id as usize))
    }
}
