use crate::{CanisterId, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ChatId(pub(crate) CanisterId);

impl Display for ChatId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

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
        user_id.0.into()
    }
}
