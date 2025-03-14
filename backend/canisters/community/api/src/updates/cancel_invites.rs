use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UserId};

#[ts_export(community, cancel_invites)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, cancel_invites)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    ChannelNotFound,
    UserSuspended,
    UserLapsed,
    Error(OCError),
}
