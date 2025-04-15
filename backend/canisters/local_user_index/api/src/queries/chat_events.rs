use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, ChatId, CommunityId, EventIndex, MessageIndex, TimestampMillis, UserId};

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub requests: Vec<EventsArgs>,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsArgs {
    pub context: EventsContext,
    pub args: EventsSelectionCriteria,
    pub latest_known_update: Option<TimestampMillis>,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsContext {
    Direct(UserId),
    Group(ChatId, Option<MessageIndex>),
    Channel(CommunityId, ChannelId, Option<MessageIndex>),
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsSelectionCriteria {
    Page(EventsPageArgs),
    ByIndex(EventsByIndexArgs),
    Window(EventsWindowArgs),
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsPageArgs {
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_messages: u32,
    pub max_events: u32,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsByIndexArgs {
    pub events: Vec<EventIndex>,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsWindowArgs {
    pub mid_point: MessageIndex,
    pub max_messages: u32,
    pub max_events: u32,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub responses: Vec<EventsResponse>,
    pub timestamp: TimestampMillis,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    NotFound,
    ReplicaNotUpToDate(TimestampMillis),
    InternalError(String),
    Error(OCError),
}

impl From<community_canister::EventsResponse> for EventsResponse {
    fn from(value: community_canister::EventsResponse) -> Self {
        match value {
            community_canister::EventsResponse::Success(events) => EventsResponse::Success(events),
            community_canister::EventsResponse::Error(error) => EventsResponse::Error(error),
        }
    }
}

impl From<group_canister::EventsResponse> for EventsResponse {
    fn from(value: group_canister::EventsResponse) -> Self {
        match value {
            group_canister::EventsResponse::Success(events) => EventsResponse::Success(events),
            group_canister::EventsResponse::Error(error) => EventsResponse::Error(error),
        }
    }
}

impl From<user_canister::EventsResponse> for EventsResponse {
    fn from(value: user_canister::EventsResponse) -> Self {
        match value {
            user_canister::EventsResponse::Success(events) => EventsResponse::Success(events),
            user_canister::EventsResponse::Error(error) => EventsResponse::Error(error),
        }
    }
}
