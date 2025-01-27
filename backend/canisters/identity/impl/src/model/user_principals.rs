use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{is_default, CanisterId, PushIfNotContains, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipals {
    user_principals: Vec<UserPrincipalInternal>,
    auth_principals: HashMap<Principal, AuthPrincipalInternal>,
    originating_canisters: HashMap<CanisterId, u32>,
}

#[allow(dead_code)]
pub struct UserPrincipal {
    pub index: u32,
    pub principal: Principal,
    pub auth_principals: Vec<Principal>,
    pub user_id: Option<UserId>,
}

#[derive(Serialize, Deserialize)]
struct UserPrincipalInternal {
    #[serde(rename = "p")]
    principal: Principal,
    #[serde(rename = "a")]
    auth_principals: Vec<Principal>,
    #[serde(rename = "u", default, skip_serializing_if = "Option::is_none")]
    user_id: Option<UserId>,
}

#[derive(Serialize, Deserialize)]
struct AuthPrincipalInternal {
    #[serde(rename = "o")]
    originating_canister: CanisterId,
    #[serde(rename = "u")]
    user_principal_index: u32,
    #[serde(rename = "i", default, skip_serializing_if = "is_default")]
    is_ii_principal: bool,
}

impl UserPrincipals {
    pub fn push(
        &mut self,
        index: u32,
        principal: Principal,
        auth_principal: Principal,
        originating_canister: CanisterId,
        is_ii_principal: bool,
    ) {
        assert_eq!(index, self.next_index());
        assert!(!self.auth_principals.contains_key(&auth_principal));

        self.user_principals.push(UserPrincipalInternal {
            principal,
            auth_principals: vec![auth_principal],
            user_id: None,
        });
        self.auth_principals.insert(
            auth_principal,
            AuthPrincipalInternal {
                originating_canister,
                user_principal_index: index,
                is_ii_principal,
            },
        );
        *self.originating_canisters.entry(originating_canister).or_default() += 1;
    }

    pub fn link_auth_principal_with_existing_user(
        &mut self,
        new_principal: Principal,
        originating_canister: CanisterId,
        is_ii_principal: bool,
        user_principal_index: u32,
    ) -> bool {
        if self
            .get_by_auth_principal(&new_principal)
            .is_some_and(|u| u.user_id.is_some())
        {
            false
        } else if let Some(user_principal) = self.user_principals.get_mut(user_principal_index as usize) {
            user_principal.auth_principals.push_if_not_contains(new_principal);
            self.auth_principals.insert(
                new_principal,
                AuthPrincipalInternal {
                    originating_canister,
                    user_principal_index,
                    is_ii_principal,
                },
            );
            true
        } else {
            unreachable!()
        }
    }

    pub fn unlink_auth_principal(&mut self, linked_principal: Principal, user_principal_index: u32) -> bool {
        let exists_user_with_linked_principal = self
            .get_by_auth_principal(&linked_principal)
            .is_some_and(|u| u.user_id.is_some());

        if exists_user_with_linked_principal {
            let current_user = self.user_principals.get_mut(user_principal_index as usize);

            if let Some(user_principal) = current_user {
                user_principal.auth_principals.retain(|&ap| ap != linked_principal);
                self.auth_principals.remove(&linked_principal);

                return true;
            }
        }

        false
    }

    pub fn next_index(&self) -> u32 {
        self.user_principals.len().try_into().unwrap()
    }

    pub fn get_by_auth_principal(&self, auth_principal: &Principal) -> Option<UserPrincipal> {
        self.auth_principals
            .get(auth_principal)
            .and_then(|a| self.user_principal_by_index(a.user_principal_index))
    }

    pub fn get_auth_principal(&self, auth_principal: &Principal) -> Option<AuthPrincipal> {
        self.auth_principals.get(auth_principal).map(|a| a.into())
    }

    pub fn user_principals_count(&self) -> u32 {
        self.user_principals.len() as u32
    }

    pub fn auth_principals_count(&self) -> u32 {
        self.auth_principals.len() as u32
    }

    pub fn originating_canisters(&self) -> &HashMap<CanisterId, u32> {
        &self.originating_canisters
    }

    // This is O(number of users) so we may need to revisit this in the future, but it is only
    // called once per user so is fine for now.
    pub fn set_user_id(&mut self, principal: Principal, user_id: Option<UserId>) -> bool {
        if let Some(user) = self.user_principals.iter_mut().find(|u| u.principal == principal) {
            user.user_id = user_id;
            true
        } else {
            false
        }
    }

    pub fn set_ii_principal(&mut self, principal: &Principal) {
        if let Some(a) = self.auth_principals.get_mut(principal) {
            a.is_ii_principal = true;
        }
    }

    fn user_principal_by_index(&self, user_principal_index: u32) -> Option<UserPrincipal> {
        self.user_principals
            .get(usize::try_from(user_principal_index).unwrap())
            .map(|u| UserPrincipal {
                index: user_principal_index,
                principal: u.principal,
                auth_principals: u.auth_principals.clone(),
                user_id: u.user_id,
            })
    }
}

pub struct AuthPrincipal {
    pub originating_canister: CanisterId,
    pub user_principal_index: u32,
    pub is_ii_principal: bool,
}

impl From<&AuthPrincipalInternal> for AuthPrincipal {
    fn from(value: &AuthPrincipalInternal) -> Self {
        AuthPrincipal {
            originating_canister: value.originating_canister,
            user_principal_index: value.user_principal_index,
            is_ii_principal: value.is_ii_principal,
        }
    }
}
