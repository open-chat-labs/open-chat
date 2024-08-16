use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, user_registration_canister)]
pub enum Response {
    Success(CanisterId),
    NewRegistrationsClosed,
}
