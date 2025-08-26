use crate::{CanisterId, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Display, Formatter};
use std::ops::Deref;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ChatId(CanisterId);

impl From<Principal> for ChatId {
    fn from(principal: Principal) -> Self {
        ChatId(principal)
    }
}

impl From<ChatId> for CanisterId {
    fn from(chat_id: ChatId) -> Self {
        chat_id.0
    }
}

impl From<UserId> for ChatId {
    fn from(user_id: UserId) -> Self {
        Principal::from(user_id).into()
    }
}

impl Debug for ChatId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl Display for ChatId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self.0, f)
    }
}

impl Deref for ChatId {
    type Target = CanisterId;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
