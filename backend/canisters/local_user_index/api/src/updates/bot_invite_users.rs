use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, UnitResult, UserId};

#[ts_export(local_user_index, bot_invite_users)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub user_ids: Vec<UserId>,
}

pub type Response = UnitResult;
