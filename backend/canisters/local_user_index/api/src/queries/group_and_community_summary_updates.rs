use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    CanisterId, CommunityCanisterCommunitySummary, CommunityCanisterCommunitySummaryUpdates, GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates, TimestampMillis,
};

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub requests: Vec<SummaryUpdatesArgs>,
}

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SummaryUpdatesArgs {
    pub canister_id: CanisterId,
    pub is_community: bool,
    pub invite_code: Option<u64>,
    pub updates_since: Option<TimestampMillis>,
}

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<SummaryUpdatesResponse>),
}

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum SummaryUpdatesResponse {
    SuccessGroup(GroupCanisterGroupChatSummary),
    SuccessCommunity(CommunityCanisterCommunitySummary),
    SuccessGroupUpdates(GroupCanisterGroupChatSummaryUpdates),
    SuccessCommunityUpdates(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    NotFound,
    InternalError(String),
    Error(OCError),
}

impl From<community_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary::Response) -> Self {
        match value {
            community_canister::summary::Response::Success(summary) => Self::SuccessCommunity(summary),
            community_canister::summary::Response::PrivateCommunity => Self::NotFound,
            community_canister::summary::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<community_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary_updates::Response) -> Self {
        match value {
            community_canister::summary_updates::Response::Success(updates) => Self::SuccessCommunityUpdates(updates),
            community_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            community_canister::summary_updates::Response::PrivateCommunity => Self::NotFound,
            community_canister::summary_updates::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<group_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary::Response) -> Self {
        match value {
            group_canister::summary::Response::Success(result) => Self::SuccessGroup(result.summary),
            group_canister::summary::Response::CallerNotInGroup => Self::NotFound,
            group_canister::summary::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<group_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary_updates::Response) -> Self {
        match value {
            group_canister::summary_updates::Response::Success(result) => Self::SuccessGroupUpdates(result.updates),
            group_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            group_canister::summary_updates::Response::CallerNotInGroup => Self::NotFound,
            group_canister::summary_updates::Response::Error(error) => Self::Error(error),
        }
    }
}
