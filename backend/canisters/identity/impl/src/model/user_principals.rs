use candid::Principal;
use identity_canister::remove_identity_link::Response as RemovePrincipalResponse;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::collections::HashMap;
use types::{is_default, CanisterId, PushIfNotContains, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserPrincipals {
    user_principals: Vec<UserPrincipalInternal>,
    auth_principals: HashMap<Principal, AuthPrincipalInternal>,
    originating_canisters: HashMap<CanisterId, u32>,
    temp_keys: HashMap<Principal, TempKey>,
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
    #[serde(rename = "u", skip_serializing_if = "Option::is_none")]
    user_id: Option<UserId>,
}

#[derive(Serialize, Deserialize)]
struct AuthPrincipalInternal {
    #[serde(rename = "o")]
    originating_canister: CanisterId,
    #[serde(rename = "u")]
    user_principal_index: u32,
    #[serde(rename = "w", skip_serializing_if = "is_default")]
    webauthn_credential_id: Option<ByteBuf>,
    #[serde(rename = "i", default, skip_serializing_if = "is_default")]
    is_ii_principal: bool,
    #[serde(rename = "l", default, skip_serializing_if = "is_default")]
    last_used: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
struct TempKey {
    #[serde(rename = "c")]
    created: TimestampMillis,
    #[serde(rename = "e")]
    expires: TimestampMillis,
    #[serde(rename = "p")]
    auth_principal: Principal,
}

impl UserPrincipals {
    #[allow(clippy::too_many_arguments)]
    pub fn push(
        &mut self,
        index: u32,
        principal: Principal,
        auth_principal: Principal,
        originating_canister: CanisterId,
        webauthn_credential_id: Option<ByteBuf>,
        is_ii_principal: bool,
        now: TimestampMillis,
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
                webauthn_credential_id,
                is_ii_principal,
                last_used: now,
            },
        );
        self.incr_originating_canister(originating_canister);
    }

    pub fn add_temp_key(
        &mut self,
        temp_key: Principal,
        auth_principal: Principal,
        now: TimestampMillis,
        expires: TimestampMillis,
    ) {
        self.temp_keys.insert(
            temp_key,
            TempKey {
                created: now,
                expires,
                auth_principal,
            },
        );
    }

    pub fn link_auth_principal_with_existing_user(
        &mut self,
        new_principal: Principal,
        originating_canister: CanisterId,
        webauthn_credential_id: Option<ByteBuf>,
        is_ii_principal: bool,
        user_principal_index: u32,
        now: TimestampMillis,
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
                    webauthn_credential_id,
                    is_ii_principal,
                    last_used: now,
                },
            );
            self.incr_originating_canister(originating_canister);
            true
        } else {
            unreachable!()
        }
    }

    pub fn remove_auth_principal(&mut self, caller: Principal, linked_principal: Principal) -> RemovePrincipalResponse {
        if caller == linked_principal {
            RemovePrincipalResponse::CannotUnlinkActivePrincipal
        } else {
            if let Some(user) = self.user_principal_mut(&caller) {
                // This condition may be redundant, but in combination with the
                // responses can provide additional context in case of an error.
                if user.auth_principals.contains(&linked_principal) {
                    user.auth_principals.retain(|&ap| ap != linked_principal);
                    self.auth_principals.remove(&linked_principal);

                    return RemovePrincipalResponse::Success;
                }

                return RemovePrincipalResponse::IdentityLinkNotFound;
            }

            RemovePrincipalResponse::UserNotFound
        }
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

    pub fn auth_principal_exists(&self, auth_principal: &Principal) -> bool {
        self.auth_principals.contains_key(auth_principal)
    }

    // Returns the underlying auth principal if the caller is using a temp key, else returns the
    // calling principal
    pub fn unwrap_temp_key_or(&self, caller: Principal) -> Principal {
        self.temp_keys.get(&caller).map_or(caller, |k| k.auth_principal)
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

    pub fn get_originating_canisters_by_user_id_slow(&self, user_id: UserId) -> Vec<(CanisterId, bool)> {
        if let Some(user_principal) = self.user_principals.iter().find(|u| u.user_id == Some(user_id)) {
            user_principal
                .auth_principals
                .iter()
                .filter_map(|p| self.auth_principals.get(p))
                .map(|p| (p.originating_canister, p.is_ii_principal))
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn bump_last_used(&mut self, auth_principal: &Principal, now: TimestampMillis) {
        if let Some(principal) = self.auth_principals.get_mut(auth_principal) {
            principal.last_used = now;
        }
    }

    pub fn set_ii_principal(&mut self, principal: &Principal) {
        if let Some(a) = self.auth_principals.get_mut(principal) {
            a.is_ii_principal = true;
        }
    }

    pub fn remove_expired_temp_keys(&mut self, now: TimestampMillis) {
        self.temp_keys.retain(|_, k| k.expires > now);
    }

    fn user_principal_mut(&mut self, auth_principal: &Principal) -> Option<&mut UserPrincipalInternal> {
        self.auth_principals
            .get(auth_principal)
            .and_then(|p| self.user_principals.get_mut(p.user_principal_index as usize))
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

    fn incr_originating_canister(&mut self, canister_id: CanisterId) {
        *self.originating_canisters.entry(canister_id).or_default() += 1;
    }
}

pub struct AuthPrincipal {
    pub originating_canister: CanisterId,
    pub user_principal_index: u32,
    pub webauthn_credential_id: Option<Vec<u8>>,
    pub is_ii_principal: bool,
    pub last_used: TimestampMillis,
}

impl From<&AuthPrincipalInternal> for AuthPrincipal {
    fn from(value: &AuthPrincipalInternal) -> Self {
        AuthPrincipal {
            originating_canister: value.originating_canister,
            user_principal_index: value.user_principal_index,
            webauthn_credential_id: value.webauthn_credential_id.as_ref().map(|c| c.to_vec()),
            is_ii_principal: value.is_ii_principal,
            last_used: value.last_used,
        }
    }
}
