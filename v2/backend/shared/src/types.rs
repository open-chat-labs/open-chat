use crate::time::TimestampMillis;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

pub mod chat_id;
pub mod direct_message;
pub mod group_message;
pub mod indexed_event;
pub mod message_content;
pub mod notifications;
pub mod v1_message;

pub type CanisterId = Principal;

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct EventIndex(u32);

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageIndex(u32);

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct MessageId(u128);

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

impl EventIndex {
    pub fn incr(&self) -> EventIndex {
        EventIndex(self.0 + 1)
    }
}

impl From<u32> for EventIndex {
    fn from(val: u32) -> Self {
        EventIndex(val)
    }
}

impl From<EventIndex> for u32 {
    fn from(event_index: EventIndex) -> Self {
        event_index.0
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

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Event<T: CandidType + Clone + Debug> {
    pub index: EventIndex,
    pub timestamp: TimestampMillis,
    pub event: T,
}
