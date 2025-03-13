use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[ts_export(user_index, user_registration_canister)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
    NewRegistrationsClosed,
    Error(u16, Option<String>),
}
