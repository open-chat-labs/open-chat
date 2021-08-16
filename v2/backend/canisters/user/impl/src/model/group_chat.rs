use types::GroupChatId;

#[allow(dead_code)]
pub struct GroupChat {
    group_chat_id: GroupChatId,
}

impl GroupChat {
    pub fn new(group_chat_id: GroupChatId) -> GroupChat {
        GroupChat { group_chat_id }
    }
}
