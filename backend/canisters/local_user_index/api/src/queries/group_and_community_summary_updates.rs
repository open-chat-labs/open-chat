use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    CanisterId, CommunityCanisterCommunitySummary, CommunityCanisterCommunitySummaryUpdates, GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates, TimestampMillis,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub requests: Vec<SummaryUpdatesArgs>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SummaryUpdatesArgs {
    pub canister_id: CanisterId,
    pub is_community: bool,
    pub invite_code: Option<u64>,
    pub updates_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<SummaryUpdatesResponse>),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum SummaryUpdatesResponse {
    SuccessGroup(GroupCanisterGroupChatSummary),
    SuccessCommunity(CommunityCanisterCommunitySummary),
    SuccessGroupUpdates(GroupCanisterGroupChatSummaryUpdates),
    SuccessCommunityUpdates(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    NotFound,
    InternalError(String),
}

impl From<community_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary::Response) -> Self {
        match value {
            community_canister::summary::Response::Success(summary) => Self::SuccessCommunity(summary),
            community_canister::summary::Response::PrivateCommunity => Self::NotFound,
        }
    }
}

impl From<community_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary_updates::Response) -> Self {
        match value {
            community_canister::summary_updates::Response::Success(updates) => Self::SuccessCommunityUpdates(updates),
            community_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            community_canister::summary_updates::Response::PrivateCommunity => Self::NotFound,
        }
    }
}

impl From<group_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary::Response) -> Self {
        match value {
            group_canister::summary::Response::Success(result) => Self::SuccessGroup(result.summary),
            group_canister::summary::Response::CallerNotInGroup => Self::NotFound,
        }
    }
}

impl From<group_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary_updates::Response) -> Self {
        match value {
            group_canister::summary_updates::Response::Success(result) => Self::SuccessGroupUpdates(result.updates),
            group_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            group_canister::summary_updates::Response::CallerNotInGroup => Self::NotFound,
        }
    }
}
