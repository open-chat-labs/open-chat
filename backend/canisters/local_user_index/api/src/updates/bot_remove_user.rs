use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotCommunityOrGroupContext, ChannelId, UnitResult, UserId};

#[ts_export(local_user_index, bot_remove_user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub community_or_group_context: BotCommunityOrGroupContext,
    pub channel_id: Option<ChannelId>,
    pub user_id: UserId,
    pub block: bool,
}

pub type Response = UnitResult;
