use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex, ThreadPreview, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub threads: Vec<MessageIndex>,
    pub latest_client_thread_update: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    ReplicaNotUpToDate(TimestampMillis),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub timestamp: TimestampMillis,
}
