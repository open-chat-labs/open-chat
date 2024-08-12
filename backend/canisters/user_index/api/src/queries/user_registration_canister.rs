use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(CanisterId),
    NewRegistrationsClosed,
}
