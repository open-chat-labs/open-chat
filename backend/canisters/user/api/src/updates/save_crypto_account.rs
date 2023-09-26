use crate::NamedAccount;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = NamedAccount;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Invalid,
    NameTaken,
    UserSuspended,
}
