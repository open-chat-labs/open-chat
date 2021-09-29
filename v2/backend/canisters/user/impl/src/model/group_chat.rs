use candid::CandidType;
use serde::Deserialize;
use types::ChatId;

#[derive(CandidType, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
}

impl GroupChat {
    pub fn new(chat_id: ChatId) -> GroupChat {
        GroupChat { chat_id }
    }
}
