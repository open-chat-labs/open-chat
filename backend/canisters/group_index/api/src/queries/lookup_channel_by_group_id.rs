use candid::CandidType;
use ts_export::ts_export;
use types::{ChannelId, ChatId, CommunityId};

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
