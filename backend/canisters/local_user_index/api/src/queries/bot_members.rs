use candid::Deserialize;
use serde::Serialize;
use std::collections::HashSet;
use ts_export::ts_export;
use types::{BotCommunityOrGroupContext, ChannelId, MemberType, MembersResponse};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_members)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_or_group_context: BotCommunityOrGroupContext,
    pub channel_id: Option<ChannelId>,
    pub member_types: HashSet<MemberType>,
}

pub type Response = MembersResponse;
