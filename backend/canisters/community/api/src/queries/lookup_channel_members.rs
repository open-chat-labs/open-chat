use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, GroupMember, TimestampMillis, UserId};

#[ts_export(community, lookup_channel_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    // At most 1000
    pub user_ids: Vec<UserId>,
    // The latest timestamp of the details the caller holds (see `selected_initial`), so that a
    // replica which is behind that, and so could return members who have since left, returns
    // `ReplicaNotUpToDate` instead
    pub latest_known_update: Option<TimestampMillis>,
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
