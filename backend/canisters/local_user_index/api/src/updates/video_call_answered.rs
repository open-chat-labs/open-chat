use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, MessageId, UnitResult, UserId};

// Called by a video call operator (the bridge) when a user answers a ring from an iPhone with
// no web layer running. The local user index stops the ring on that user's other phones.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub chat_id: Chat,
    pub message_id: MessageId,
}

pub type Response = UnitResult;
