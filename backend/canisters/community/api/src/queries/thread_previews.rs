use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, ThreadPreview, TimestampMillis};

#[ts_export(community, thread_previews)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub threads: Vec<MessageIndex>,
    pub latest_client_thread_update: Option<TimestampMillis>,
}

#[ts_export(community, thread_previews)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    ReplicaNotUpToDate(TimestampMillis),
    Error(OCError),
}

#[ts_export(community, thread_previews)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub timestamp: TimestampMillis,
}
