use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(group, toggle_mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub mute: bool,
}

#[ts_export(group, toggle_mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    Error(OCError),
}
