use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::EmptySuccessOrError;

#[ts_export(community, set_member_display_name)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub display_name: Option<String>,
    pub new_achievement: bool,
}

pub type Response = EmptySuccessOrError;
