use crate::{EventWrapper, Message};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadPreview {
    pub root_message: EventWrapper<Message>,
    pub latest_replies: Vec<EventWrapper<Message>>,
    pub total_replies: u32,
}
