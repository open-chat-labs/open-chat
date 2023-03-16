use serde::{Deserialize, Serialize};
use types::{ChatId, MessageIndex, UserId};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UserJoinedGroup(UserJoinedGroup),
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub latest_message_index: Option<MessageIndex>,
}
