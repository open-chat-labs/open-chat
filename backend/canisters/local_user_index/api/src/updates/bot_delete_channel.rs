use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AuthToken, ChannelId, UnitResult};

#[ts_export(local_user_index, bot_delete_channel)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub auth_token: AuthToken,
}

pub type Response = UnitResult;
