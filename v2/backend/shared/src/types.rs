use candid::{CandidType, Principal};
use serde::Deserialize;

pub mod chat_id;
pub mod message_content;
pub mod reply_context;

pub type CanisterId = Principal;

#[derive(CandidType, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u32);

#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserId(Principal);

impl From<Principal> for UserId {
    fn from(principal: Principal) -> Self {
        UserId(principal)
    }
}

impl From<UserId> for Principal {
    fn from(user_id: UserId) -> Self {
        user_id.0
    }
}

impl MessageId {
    pub fn incr(&self) -> MessageId {
        MessageId(self.0 + 1)
    }
}
