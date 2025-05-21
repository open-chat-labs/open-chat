use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    CanisterId, CommunityCanisterCommunitySummary, CommunityCanisterCommunitySummaryUpdates, GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates, TimestampMillis,
};

#[ts_export(local_user_index, group_and_community_summary_updates_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub requests: Vec<SummaryUpdatesArgs>,
    pub max_c2c_calls: usize,
}

#[ts_export(local_user_index, group_and_community_summary_updates_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SummaryUpdatesArgs {
    pub canister_id: CanisterId,
    pub is_community: bool,
    pub invite_code: Option<u64>,
    pub updates_since: Option<TimestampMillis>,
}

#[ts_export(local_user_index, group_and_community_summary_updates_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(local_user_index, group_and_community_summary_updates_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: Vec<SummaryUpdatesResponse>,
    #[ts(as = "Vec::<ts_export::TSPrincipal>")]
    pub excess_updates: Vec<CanisterId>,
    #[ts(as = "Vec::<(ts_export::TSPrincipal, OCError)>")]
    pub errors: Vec<(CanisterId, OCError)>,
    #[ts(as = "Vec::<ts_export::TSPrincipal>")]
    pub not_found: Vec<CanisterId>,
}

#[ts_export(local_user_index, group_and_community_summary_updates_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum SummaryUpdatesResponse {
    SuccessGroup(GroupCanisterGroupChatSummary),
    SuccessCommunity(CommunityCanisterCommunitySummary),
    SuccessGroupUpdates(GroupCanisterGroupChatSummaryUpdates),
    SuccessCommunityUpdates(CommunityCanisterCommunitySummaryUpdates),
    SuccessNoUpdates,
    Error(OCError),
}

impl From<community_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary::Response) -> Self {
        match value {
            community_canister::summary::Response::Success(summary) => Self::SuccessCommunity(summary),
            community_canister::summary::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<community_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: community_canister::summary_updates::Response) -> Self {
        match value {
            community_canister::summary_updates::Response::Success(updates) => Self::SuccessCommunityUpdates(updates),
            community_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            community_canister::summary_updates::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<group_canister::summary::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary::Response) -> Self {
        match value {
            group_canister::summary::Response::Success(result) => Self::SuccessGroup(result.summary),
            group_canister::summary::Response::Error(error) => Self::Error(error),
        }
    }
}

impl From<group_canister::summary_updates::Response> for SummaryUpdatesResponse {
    fn from(value: group_canister::summary_updates::Response) -> Self {
        match value {
            group_canister::summary_updates::Response::Success(result) => Self::SuccessGroupUpdates(result.updates),
            group_canister::summary_updates::Response::SuccessNoUpdates => Self::SuccessNoUpdates,
            group_canister::summary_updates::Response::Error(error) => Self::Error(error),
        }
    }
}
