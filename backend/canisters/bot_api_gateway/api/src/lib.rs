#![allow(unused_imports)]

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

pub mod c2c_handle_bot_actions {
    use candid::CandidType;
    use serde::{Deserialize, Serialize};
    use types::{BotAction, CanisterId, UserId};

    #[derive(Serialize, Deserialize, Debug)]
    pub struct Args {
        pub bot_user_id: UserId,
        pub bot_username: String,
        pub actions: Vec<BotAction>,
    }

    pub type Response = Result<(), HandleBotActionsError>;

    #[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
    pub enum HandleBotActionsError {
        NotAuthorized,
        Frozen,
        Other(String),
    }
}
