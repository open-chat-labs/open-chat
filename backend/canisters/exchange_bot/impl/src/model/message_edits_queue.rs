use serde::{Deserialize, Serialize};
use std::collections::btree_map::Entry::{Occupied, Vacant};
use std::collections::BTreeMap;
use types::{MessageId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct MessageEditsQueue {
    messages: BTreeMap<(UserId, MessageId), String>,
}

impl MessageEditsQueue {
    pub fn push(&mut self, user_id: UserId, message_id: MessageId, text: String, overwrite_existing: bool) -> bool {
        match self.messages.entry((user_id, message_id)) {
            Vacant(e) => {
                e.insert(text);
                true
            }
            Occupied(mut e) if overwrite_existing => {
                e.insert(text);
                true
            }
            _ => false,
        }
    }

    pub fn pop(&mut self) -> Option<(UserId, MessageId, String)> {
        self.messages.pop_first().map(|((u, m), t)| (u, m, t))
    }

    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}
