use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityRole, UnitResult, UserId};

#[ts_export(community, change_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: CommunityRole,
}

pub type Response = UnitResult;
