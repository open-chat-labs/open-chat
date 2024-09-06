use candid::CandidType;
use ts_export::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[ts_export(user, local_user_index)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(CanisterId),
}
