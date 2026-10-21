use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BridgedUserId, BridgedUserSummary};

// At most `MAX_BRIDGED_USERS` are looked up, the rest are ignored
#[ts_export(user_index, bridged_users)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<BridgedUserId>,
}

// The profiles of the given accounts which a bridge bot has relayed a message from. Others are left out.
#[ts_export(user_index, bridged_users)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<BridgedUserSummary>),
}

pub const MAX_BRIDGED_USERS: usize = 100;
