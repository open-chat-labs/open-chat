use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, MessageId, MessageIndex, MiniAppStatusUpdate, UnitResult};

// The MiniApp service updates a card's status: the game starting with its players and settings, or its
// finishing with its result and end state
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppStatusUpdate,
}

pub type Response = UnitResult;
