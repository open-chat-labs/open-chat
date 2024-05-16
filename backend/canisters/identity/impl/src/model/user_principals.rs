use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::CanisterId;

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipals {
    user_principals: Vec<UserPrincipalInternal>,
    auth_principals: HashMap<Principal, AuthPrincipalInternal>,
}

pub struct UserPrincipal {
    pub index: u32,
    pub principal: Principal,
    pub auth_principals: Vec<Principal>,
}

#[derive(Serialize, Deserialize)]
struct UserPrincipalInternal {
    #[serde(rename = "p")]
    principal: Principal,
    #[serde(rename = "a")]
    auth_principals: Vec<Principal>,
}

#[derive(Serialize, Deserialize)]
struct AuthPrincipalInternal {
    #[serde(rename = "o")]
    originating_canister: CanisterId,
    #[serde(rename = "u")]
    user_principal_index: u32,
}

impl UserPrincipals {
    pub fn push(&mut self, index: u32, principal: Principal, auth_principal: Principal, originating_canister: CanisterId) {
        assert_eq!(index, self.next_index());
        assert!(!self.auth_principals.contains_key(&auth_principal));

        self.user_principals.push(UserPrincipalInternal {
            principal,
            auth_principals: vec![auth_principal],
        });
        self.auth_principals.insert(
            auth_principal,
            AuthPrincipalInternal {
                originating_canister,
                user_principal_index: index,
            },
        );
    }

    pub fn next_index(&self) -> u32 {
        self.user_principals.len().try_into().unwrap()
    }

    pub fn get_by_auth_principal(&self, auth_principal: &Principal) -> Option<UserPrincipal> {
        self.auth_principals
            .get(auth_principal)
            .and_then(|a| self.user_principal_by_index(a.user_principal_index))
    }

    pub fn user_principals_count(&self) -> u32 {
        self.user_principals.len() as u32
    }

    pub fn auth_principals_count(&self) -> u32 {
        self.auth_principals.len() as u32
    }

    fn user_principal_by_index(&self, user_principal_index: u32) -> Option<UserPrincipal> {
        self.user_principals
            .get(usize::try_from(user_principal_index).unwrap())
            .map(|u| UserPrincipal {
                index: user_principal_index,
                principal: u.principal,
                auth_principals: u.auth_principals.clone(),
            })
    }
}
