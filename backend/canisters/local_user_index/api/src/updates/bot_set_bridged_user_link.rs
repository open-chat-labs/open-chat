use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, BridgedUser, UnitResult};

// For a bridge bot to link an account on its platform to the OpenChat user who ran one of its
// commands, eg. `/link`, or to unlink the account from them. The command's access token, as the
// `chat_context`, proves who the user is. With an autonomous `chat_context` (for any chat) the bot
// can only unlink the account, from whoever it's linked to, eg. when its owner asks on the other
// platform.
#[ts_export(local_user_index, bot_set_bridged_user_link)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub bridged_user: BridgedUser,
    pub linked: bool,
}

pub type Response = UnitResult;
