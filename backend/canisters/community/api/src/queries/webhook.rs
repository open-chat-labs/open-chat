use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UserId};

#[ts_export(community, webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub id: UserId,
}

#[ts_export(community, webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, webhook)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub id: UserId,
    pub secret: String,
}
