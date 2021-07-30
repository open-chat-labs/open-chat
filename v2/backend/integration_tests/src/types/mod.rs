use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

pub mod chat_id;
pub mod indexed_event;
pub mod message_content;
pub mod notifications;

pub type CanisterId = Principal;
pub type TimestampMillis = u64;

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageIndex(u32);

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(pub u128);

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
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

#[derive(CandidType, Deserialize, Clone)]
pub struct CanisterWasm {
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
    pub version: Version,
}

#[derive(CandidType, Deserialize, Clone, Debug, Ord, PartialOrd, Eq, PartialEq)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl Version {
    pub fn new(major: u32, minor: u32, patch: u32) -> Version {
        Version { major, minor, patch }
    }
}
