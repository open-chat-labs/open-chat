use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub channel_id: ChannelId,
    pub users: Vec<(UserId, Principal)>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
    pub channel_name: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
    pub channel_name: String,
    pub failed_users: Vec<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub failed_users: Vec<UserId>,
}
