use candid::CandidType;
use community_canister::c2c_bot_community_summary::{CommunitySummary, Response as C2CResponse};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CommunityId;

#[ts_export(local_user_index, bot_community_summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
}

#[ts_export(local_user_index, bot_community_summary)]
#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunitySummary),
    Error(OCError),
}

impl From<C2CResponse> for Response {
    fn from(value: C2CResponse) -> Self {
        match value {
            C2CResponse::Success(summary) => Response::Success(summary),
            C2CResponse::Error(error) => Response::Error(error),
        }
    }
}
