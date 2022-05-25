use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageId, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: Reaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Added(EventIndex),
    Removed(EventIndex),
    InvalidReaction,
    MessageNotFound,
    CallerNotInGroup,
    NotAuthorized,
}
