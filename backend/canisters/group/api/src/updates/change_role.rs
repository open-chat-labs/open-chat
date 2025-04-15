use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, GroupRole, UserId};

#[ts_export(group, change_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: GroupRole,
    pub correlation_id: u64,
}

pub type Response = EmptySuccessOrError;
