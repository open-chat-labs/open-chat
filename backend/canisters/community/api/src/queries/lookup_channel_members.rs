use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, GroupMember, UserId};

#[ts_export(community, lookup_channel_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, lookup_channel_members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, lookup_channel_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Those of the users who are members of the channel
    pub members: Vec<GroupMember>,
}
