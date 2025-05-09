use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AuthToken, ChannelId, MessageId, MessageIndex, UnitResult};

#[ts_export(local_user_index, bot_delete_messages)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub thread: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub auth_token: AuthToken,
}

pub type Response = UnitResult;
