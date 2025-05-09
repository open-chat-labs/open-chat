use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AuthToken, ChannelId, MessageId, MessageIndex, Reaction, UnitResult};

#[ts_export(local_user_index, bot_react_to_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub auth_token: AuthToken,
}

pub type Response = UnitResult;
