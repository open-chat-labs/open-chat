use candid::{CandidType, Principal};
use serde::Deserialize;

pub mod chat_id;
pub mod message_content;
pub mod message_notifications;

pub type CanisterId = Principal;

#[derive(CandidType, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageIndex(u32);

#[derive(CandidType, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserId(CanisterId);

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

impl MessageIndex {
    pub fn incr(&self) -> MessageIndex {
        MessageIndex(self.0 + 1)
    }
}

impl From<u32> for MessageIndex {
    fn from(val: u32) -> Self {
        MessageIndex(val)
    }
}

impl From<MessageIndex> for u32 {
    fn from(message_index: MessageIndex) -> Self {
        message_index.0
    }
}
