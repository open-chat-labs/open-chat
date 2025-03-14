use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, PushEventResult};

#[ts_export(community, pin_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
}

#[ts_export(community, pin_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PushEventResult),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    MessageNotFound,
    NotAuthorized,
    NoChange,
    UserLapsed,
    Error(u16, Option<String>),
}
