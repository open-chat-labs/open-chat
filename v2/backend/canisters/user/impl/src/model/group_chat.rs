use types::ChatId;

#[allow(dead_code)]
pub struct GroupChat {
    pub chat_id: ChatId,
}

impl GroupChat {
    pub fn new(chat_id: ChatId) -> GroupChat {
        GroupChat { chat_id }
    }
}
