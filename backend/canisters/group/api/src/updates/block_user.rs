use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

#[ts_export(group, block_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}

impl From<crate::remove_participant::Response> for Response {
    fn from(response: crate::remove_participant::Response) -> Self {
        match response {
            crate::remove_participant::Response::Success => Response::Success,
            crate::remove_participant::Response::Error(error) => Response::Error(error),
        }
    }
}
