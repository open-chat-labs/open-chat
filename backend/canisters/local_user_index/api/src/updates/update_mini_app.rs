use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, MessageId, MessageIndex, MiniAppStatus, UnitResult};

// The MiniApp service writes a card's status: the game starting with its players, or finishing
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub status: MiniAppStatus,
}

pub type Response = UnitResult;
