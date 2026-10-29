use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

// A token which says which bot is calling the MiniApp service, which the bot sends with each call
pub type Args = Empty;

#[ts_export(local_user_index, bot_mini_app_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
}
