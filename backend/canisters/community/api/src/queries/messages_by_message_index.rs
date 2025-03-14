use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, MessagesResponse, TimestampMillis};

#[ts_export(community, messages_by_message_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub messages: Vec<MessageIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

#[ts_export(community, messages_by_message_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(MessagesResponse),
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    ThreadNotFound,
    UserSuspended,
    UserLapsed,
    ReplicaNotUpToDateV2(TimestampMillis),
    Error(OCError),
}
