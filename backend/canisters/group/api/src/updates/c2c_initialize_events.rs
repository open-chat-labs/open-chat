use candid::{CandidType, Principal};
use chat_events::ChatEventInternal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{EventWrapper, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<EventWrapper<ChatEventInternal>>,
    pub thread_events: HashMap<MessageIndex, Vec<EventWrapper<ChatEventInternal>>>,
    pub user_principals: HashMap<UserId, Principal>,
    pub is_complete: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
