use crate::{CanisterId, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct CommunityId(CanisterId);

impl From<Principal> for CommunityId {
    fn from(principal: Principal) -> Self {
        CommunityId(principal)
    }
}

impl From<CommunityId> for CanisterId {
    fn from(chat_id: CommunityId) -> Self {
        chat_id.0
    }
}

impl From<UserId> for CommunityId {
    fn from(user_id: UserId) -> Self {
        Principal::from(user_id).into()
    }
}

impl Debug for CommunityId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl Display for CommunityId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl AsRef<[u8]> for CommunityId {
    fn as_ref(&self) -> &[u8] {
        self.0.as_ref()
    }
}
