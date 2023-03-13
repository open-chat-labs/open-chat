use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, CanisterId, OptionUpdate};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar: OptionUpdate<Avatar>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFound,
    NotAuthorized,
    NameTooShort,
    NameTooLong,
    NameTaken,
    DescriptionTooLong,
    AvatarTooBig,
    InternalError(String),
}
