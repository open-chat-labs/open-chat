use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{MessageContent, MessageContentInitial, MessageId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct MessagesPending {
    messages: BTreeMap<(UserId, MessageId), MessagePending>,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum MessagePending {
    Send(MessageContentInitial),
    Edit(MessageContent),
}

impl MessagesPending {
    pub fn push(&mut self, user_id: UserId, message_id: MessageId, message: MessagePending) {
        self.messages.insert((user_id, message_id), message);
    }

    pub fn pop(&mut self) -> Option<(UserId, MessageId, MessagePending)> {
        self.messages.pop_first().map(|((u, id), m)| (u, id, m))
    }

    pub fn contains(&self, user_id: UserId, message_id: MessageId) -> bool {
        self.messages.contains_key(&(user_id, message_id))
    }

    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}
