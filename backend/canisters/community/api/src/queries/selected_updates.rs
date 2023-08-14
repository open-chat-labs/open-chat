use crate::selected_updates_v2;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(selected_updates_v2::SuccessResult),
    SuccessNoUpdates,
    PrivateCommunity,
}

impl From<selected_updates_v2::Response> for Response {
    fn from(value: selected_updates_v2::Response) -> Self {
        match value {
            selected_updates_v2::Response::Success(r) => Response::Success(r),
            selected_updates_v2::Response::SuccessNoUpdates(_) => Response::SuccessNoUpdates,
            selected_updates_v2::Response::PrivateCommunity => Response::PrivateCommunity,
        }
    }
}
