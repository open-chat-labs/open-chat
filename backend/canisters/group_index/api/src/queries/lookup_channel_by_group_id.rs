use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChannelId, ChatId, CommunityId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, lookup_channel_by_group_id)]
pub struct Args {
    pub group_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, lookup_channel_by_group_id)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, lookup_channel_by_group_id)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
