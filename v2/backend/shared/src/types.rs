use candid::{CandidType, Principal};
use serde::Deserialize;
use std::cmp::max;

pub mod message_content;
pub mod reply_context;

pub type CanisterId = Principal;

#[derive(CandidType, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ChatId(Vec<u8>);

#[derive(CandidType, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u32);

#[derive(CandidType, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UserId(Principal);

impl From<(&UserId, &UserId)> for ChatId {
    fn from((my_user_id, their_user_id): (&UserId, &UserId)) -> Self {
        let s1 = my_user_id.0.as_slice();
        let s2 = their_user_id.0.as_slice();
        let length = max(s1.len(), s2.len());

        let mut xor_bytes = Vec::with_capacity(length);
        for (i, byte) in xor_bytes.iter_mut().enumerate() {
            *byte = s1.get(i).unwrap_or(&0) ^ s2.get(i).unwrap_or(&0);
        }

        ChatId(xor_bytes)
    }
}

impl From<&Principal> for ChatId {
    fn from(principal: &Principal) -> Self {
        ChatId(principal.as_slice().to_vec())
    }
}

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
