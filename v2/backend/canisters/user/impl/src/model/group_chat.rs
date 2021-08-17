use types::GroupChatId;

#[allow(dead_code)]
pub struct GroupChat {
    pub chat_id: GroupChatId,
}

impl GroupChat {
    pub fn new(chat_id: GroupChatId) -> GroupChat {
        GroupChat { chat_id }
    }
}
