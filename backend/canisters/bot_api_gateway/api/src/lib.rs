#![allow(unused_imports)]

mod lifecycle;
mod queries;
mod updates;

use candid::Principal;
pub use lifecycle::*;
pub use queries::*;
use serde::{Deserialize, Serialize};
use types::{SlashCommandSchema, UserId};
pub use updates::*;

pub mod c2c_handle_bot_action {
    use candid::CandidType;
    use serde::{Deserialize, Serialize};
    use types::{BotAction, CanisterId, Chat, MessageId, MessageIndex, User, UserId};

    #[derive(Serialize, Deserialize, Debug)]
    pub struct Args {
        pub bot: User,
        pub commanded_by: Option<UserId>,
        pub chat: Chat,
        pub thread_root_message_index: Option<MessageIndex>,
        pub message_id: MessageId,
        pub action: BotAction,
        pub command_text: String,
    }

    pub type Response = Result<(), HandleBotActionsError>;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum HandleBotActionsError {
        NotAuthorized,
        Frozen,
        Other(String),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    BotRegistered(BotRegistered),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotRegistered {
    pub user_id: UserId,
    pub user_principal: Principal,
    pub name: String,
    pub commands: Vec<SlashCommandSchema>,
}
