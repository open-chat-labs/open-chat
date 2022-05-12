use candid::CandidType;
use serde::Deserialize;
use types::GroupPermissions;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub permissions: GroupPermissions,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    CallerNotInGroup,
}
