use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, MessageId, Reaction};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: Reaction,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Added(EventIndex),
    Removed(EventIndex),
    InvalidReaction,
    MessageNotFound,
    ChatNotFound,
}
