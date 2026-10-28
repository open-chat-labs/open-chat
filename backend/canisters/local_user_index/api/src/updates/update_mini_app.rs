use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, MessageId, MessageIndex, MiniAppStatusUpdate, UnitResult};

// The MiniApp service updates a card's status: the game starting with its players, whose turn it is,
// or its finishing
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppStatusUpdate,
}

pub type Response = UnitResult;
