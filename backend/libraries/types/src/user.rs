use crate::CanisterId;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserId(pub(crate) CanisterId);

impl UserId {
    pub const fn new(canister_id: CanisterId) -> UserId {
        UserId(canister_id)
    }
}

impl From<Principal> for UserId {
    fn from(principal: Principal) -> Self {
        UserId(principal)
    }
}

impl From<UserId> for CanisterId {
    fn from(user_id: UserId) -> Self {
        user_id.0
    }
}

impl Debug for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl Display for UserId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub user_id: UserId,
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct UserDetails {
    pub principal: Principal,
    pub user_id: UserId,
    pub is_bot: bool,
    pub is_platform_moderator: bool,
    pub is_platform_operator: bool,
}
