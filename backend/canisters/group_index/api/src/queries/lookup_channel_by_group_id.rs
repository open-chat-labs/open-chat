use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, ChatId, CommunityId};

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
}

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
    Error(OCError),
}

#[ts_export(group_index, lookup_channel_by_group_id)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
