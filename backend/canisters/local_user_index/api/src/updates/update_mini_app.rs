use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, MessageId, MessageIndex, MiniAppUpdate, UnitResult};

// The MiniApp service writes a card's game: its status, players and result as they now are
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppUpdate,
}

pub type Response = UnitResult;
